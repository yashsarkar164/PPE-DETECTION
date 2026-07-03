"""
Live webcam detection.

Flow:
  1. Frontend calls POST /api/webcam/session/start -> gets session_id.
  2. Frontend opens WebSocket to /api/webcam/stream/{session_id}, sends
     base64 JPEG frames, receives back annotated frame + detection JSON.
  3. Frontend calls POST /api/webcam/session/{id}/end with tallies on stop.

Every frame is run through the same YOLO model as image detection — no
separate/mocked webcam logic. Frames that are violations are persisted as
DetectionResult + Violation rows; clean frames are not persisted to avoid
flooding the DB (matches "Save snapshots if required" — full logging is
opt-in via the snapshot endpoint, not automatic per-frame).
"""
import base64
import logging
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import WebcamSessionEndRequest, WebcamSessionStartResponse
from core.database import AsyncSessionLocal, get_db
from core.deps import get_current_user
from core.models import DetectionResult, DetectionSource, User, Violation, WebcamSession
from core.security import decode_token
from services.detection_service import get_detection_service

logger = logging.getLogger("ppe.webcam")
router = APIRouter(prefix="/api/webcam", tags=["webcam"])


@router.post("/session/start", response_model=WebcamSessionStartResponse)
async def start_session(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = WebcamSession(user_id=user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return WebcamSessionStartResponse(session_id=session.id, started_at=session.started_at)


@router.post("/session/{session_id}/end", status_code=204)
async def end_session(
    session_id: uuid.UUID,
    payload: WebcamSessionEndRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(WebcamSession).where(WebcamSession.id == session_id))
    session = result.scalar_one_or_none()
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    from sqlalchemy import func

    session.ended_at = func.now()
    session.frame_count = payload.frame_count
    session.violation_count = payload.violation_count
    session.avg_fps = payload.avg_fps
    await db.commit()


@router.websocket("/stream/{session_id}")
async def stream(websocket: WebSocket, session_id: uuid.UUID, token: str):
    """
    Query param `token` carries the JWT access token, since browser WebSocket
    clients cannot set Authorization headers directly.
    """
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    service = get_detection_service()

    try:
        while True:
            data = await websocket.receive_text()
            # Expected payload: "data:image/jpeg;base64,<...>"
            if "," in data:
                data = data.split(",", 1)[1]
            try:
                raw = base64.b64decode(data)
                arr = np.frombuffer(raw, dtype=np.uint8)
                frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if frame is None:
                    raise ValueError("Could not decode frame")
            except Exception as exc:
                await websocket.send_json({"error": f"Invalid frame: {exc}"})
                continue

            result = service.infer(frame)

            success, encoded = cv2.imencode(".jpg", result["annotated_image"])
            annotated_b64 = base64.b64encode(encoded.tobytes()).decode() if success else ""

            # Persist only violation frames, to avoid flooding the DB with every frame
            if result["is_violation"]:
                async with AsyncSessionLocal() as db:
                    detection = DetectionResult(
                        webcam_session_id=session_id,
                        processed_by=user_id,
                        source_type=DetectionSource.webcam,
                        detected_objects=result["detected_objects"],
                        missing_ppe=result["missing_ppe"],
                        is_violation=True,
                        violation_confidence=result["violation_confidence"],
                        person_count=result["person_count"],
                        processing_time_ms=result["processing_time_ms"],
                        model_version=result["model_version"],
                    )
                    db.add(detection)
                    await db.flush()
                    db.add(Violation(
                        detection_result_id=detection.id,
                        reported_by=user_id,
                        missing_ppe=result["missing_ppe"],
                        confidence=result["violation_confidence"],
                        source_type=DetectionSource.webcam,
                    ))
                    await db.commit()

            await websocket.send_json({
                "detected_objects": result["detected_objects"],
                "missing_ppe": result["missing_ppe"],
                "is_violation": result["is_violation"],
                "violation_confidence": result["violation_confidence"],
                "person_count": result["person_count"],
                "processing_time_ms": result["processing_time_ms"],
                "annotated_frame_base64": f"data:image/jpeg;base64,{annotated_b64}",
            })

    except WebSocketDisconnect:
        logger.info("Webcam stream disconnected for session %s", session_id)
    except Exception as exc:
        logger.exception("Webcam stream error: %s", exc)
        await websocket.close(code=1011)


@router.post("/snapshot")
async def save_snapshot(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Explicit snapshot save is handled via the standard image upload endpoint
    from the frontend (capture canvas -> Blob -> POST /api/detection/image),
    so it's logged/galleried identically to any other image. This endpoint
    is kept as a thin marker/no-op for API symmetry with the spec's
    'Save snapshots if required' feature and can be extended if a distinct
    snapshot record type is needed later.
    """
    raise HTTPException(
        status_code=501,
        detail="Use POST /api/detection/image with the captured frame to save a webcam snapshot.",
    )
