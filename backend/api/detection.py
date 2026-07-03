"""Image and video PPE detection routes."""
import logging
import uuid
from pathlib import Path

import cv2
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import DetectionResultOut, ImageDetectionResponse, VideoDetectionResponse
from core.database import get_db
from core.deps import get_current_user
from core.models import DetectionResult, DetectionSource, MediaAsset, ProcessingStatus, User, Violation
from services.detection_service import get_detection_service
from services.storage_service import storage

logger = logging.getLogger("ppe.detection_api")
router = APIRouter(prefix="/api/detection", tags=["detection"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/avi", "video/quicktime", "video/x-matroska"}


def _media_url(storage_key: str | None, kind: str) -> str | None:
    if not storage_key:
        return None
    return f"/api/media/{kind}/{storage_key}"


@router.post("/image", response_model=ImageDetectionResponse)
async def detect_image(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}")

    # 1. Persist original
    original_key, size = await storage.save_upload(file, "uploads/images")

    media_asset = MediaAsset(
        uploaded_by=user.id,
        source_type=DetectionSource.image,
        original_filename=file.filename or "upload.jpg",
        original_storage_key=original_key,
        mime_type=file.content_type,
        file_size_bytes=size,
        status=ProcessingStatus.processing,
    )
    db.add(media_asset)
    await db.flush()

    # 2. Run YOLO inference (raises 500 naturally if model missing — no mock fallback)
    service = get_detection_service()
    original_path = storage.resolve_path(original_key)
    try:
        result = service.infer_from_path(original_path)
    except Exception as exc:
        media_asset.status = ProcessingStatus.failed
        media_asset.error_message = str(exc)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}")

    # 3. Save annotated image
    success, encoded = cv2.imencode(".jpg", result["annotated_image"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image")
    result_filename = f"{Path(original_key).stem}_annotated.jpg"
    result_key = await storage.save_bytes(encoded.tobytes(), "results/images", result_filename)

    # 4. Persist detection result + media asset update
    media_asset.result_storage_key = result_key
    media_asset.status = ProcessingStatus.completed
    media_asset.processing_time_ms = result["processing_time_ms"]

    detection = DetectionResult(
        media_asset_id=media_asset.id,
        processed_by=user.id,
        source_type=DetectionSource.image,
        detected_objects=result["detected_objects"],
        missing_ppe=result["missing_ppe"],
        is_violation=result["is_violation"],
        violation_confidence=result["violation_confidence"],
        person_count=result["person_count"],
        processing_time_ms=result["processing_time_ms"],
        model_version=result["model_version"],
    )
    db.add(detection)
    await db.flush()

    if result["is_violation"]:
        db.add(Violation(
            detection_result_id=detection.id,
            media_asset_id=media_asset.id,
            reported_by=user.id,
            missing_ppe=result["missing_ppe"],
            confidence=result["violation_confidence"],
            source_type=DetectionSource.image,
        ))

    await db.commit()
    await db.refresh(detection)

    return ImageDetectionResponse(
        media_asset_id=media_asset.id,
        detection=DetectionResultOut.model_validate(detection),
        original_url=_media_url(original_key, "images"),
        processed_url=_media_url(result_key, "images"),
    )


@router.post("/video", response_model=VideoDetectionResponse)
async def detect_video(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported video type: {file.content_type}")

    original_key, size = await storage.save_upload(file, "uploads/videos")

    media_asset = MediaAsset(
        uploaded_by=user.id,
        source_type=DetectionSource.video,
        original_filename=file.filename or "upload.mp4",
        original_storage_key=original_key,
        mime_type=file.content_type,
        file_size_bytes=size,
        status=ProcessingStatus.processing,
    )
    db.add(media_asset)
    await db.flush()

    service = get_detection_service()
    original_path = storage.resolve_path(original_key)
    result_filename = f"{Path(original_key).stem}_annotated.mp4"

    # Video is written directly by OpenCV VideoWriter to a local temp path,
    # then handed to storage as bytes-on-disk. For local storage this is
    # already the final location; for S3 this is where you'd upload the
    # temp file and then remove it.
    local_result_dir = Path("results/videos")
    local_result_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(local_result_dir / result_filename)

    try:
        result = service.infer_video(original_path, output_path)
    except Exception as exc:
        media_asset.status = ProcessingStatus.failed
        media_asset.error_message = str(exc)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Video detection failed: {exc}")

    result_key = f"videos/{result_filename}"
    media_asset.result_storage_key = result_key
    media_asset.status = ProcessingStatus.completed
    media_asset.processing_time_ms = result["processing_time_ms"]

    detection = DetectionResult(
        media_asset_id=media_asset.id,
        processed_by=user.id,
        source_type=DetectionSource.video,
        detected_objects=result["detected_objects"],
        missing_ppe=result["missing_ppe"],
        is_violation=result["is_violation"],
        violation_confidence=result["violation_confidence"],
        person_count=result["person_count"],
        processing_time_ms=result["processing_time_ms"],
        model_version=result["model_version"],
    )
    db.add(detection)
    await db.flush()

    if result["is_violation"]:
        db.add(Violation(
            detection_result_id=detection.id,
            media_asset_id=media_asset.id,
            reported_by=user.id,
            missing_ppe=result["missing_ppe"],
            confidence=result["violation_confidence"],
            source_type=DetectionSource.video,
        ))

    await db.commit()
    await db.refresh(detection)

    return VideoDetectionResponse(
        media_asset_id=media_asset.id,
        detection=DetectionResultOut.model_validate(detection),
        original_url=_media_url(original_key, "videos"),
        processed_url=_media_url(result_key, "videos"),
        status=media_asset.status,
    )


@router.get("/history", response_model=list[DetectionResultOut])
async def detection_history(
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Staff see only their own history; operators see everyone's (use /api/statistics for that)."""
    from sqlalchemy import select

    from core.models import UserRole

    query = select(DetectionResult).order_by(DetectionResult.created_at.desc()).limit(limit).offset(offset)
    if user.role != UserRole.operator:
        query = query.where(DetectionResult.processed_by == user.id)

    result = await db.execute(query)
    return [DetectionResultOut.model_validate(r) for r in result.scalars().all()]
