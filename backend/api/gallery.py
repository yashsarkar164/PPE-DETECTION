"""Gallery routes: list/search/filter images and videos, save, delete."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import GalleryListResponse, MediaAssetOut
from core.database import get_db
from core.deps import get_current_user
from core.models import DetectionResult, DetectionSource, GalleryItem, MediaAsset, User, UserRole
from services.storage_service import storage

router = APIRouter(prefix="/api/gallery", tags=["gallery"])


def _url(storage_key: str | None, kind: str) -> str | None:
    return f"/api/media/{kind}/{storage_key}" if storage_key else None


@router.get("", response_model=GalleryListResponse)
async def list_gallery(
    source_type: DetectionSource | None = None,
    search: str | None = Query(None, description="Search by filename or uploader"),
    violations_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Base: only items explicitly saved to gallery
    query = (
        select(MediaAsset, User.full_name, User.username)
        .join(GalleryItem, GalleryItem.media_asset_id == MediaAsset.id)
        .join(User, User.id == MediaAsset.uploaded_by)
    )
    count_query = select(func.count()).select_from(GalleryItem).join(
        MediaAsset, MediaAsset.id == GalleryItem.media_asset_id
    )

    # Staff only see their own gallery items; operators see all
    if user.role != UserRole.operator:
        query = query.where(MediaAsset.uploaded_by == user.id)
        count_query = count_query.where(MediaAsset.uploaded_by == user.id)

    if source_type:
        query = query.where(MediaAsset.source_type == source_type)
        count_query = count_query.where(MediaAsset.source_type == source_type)

    if search:
        like = f"%{search}%"
        query = query.where(or_(MediaAsset.original_filename.ilike(like), User.username.ilike(like)))
        count_query = count_query.where(or_(MediaAsset.original_filename.ilike(like), User.username.ilike(like)))

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(MediaAsset.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).all()

    media_ids = [row[0].id for row in rows]
    violation_map: dict[uuid.UUID, bool] = {}
    if media_ids:
        vresult = await db.execute(
            select(DetectionResult.media_asset_id, DetectionResult.is_violation).where(
                DetectionResult.media_asset_id.in_(media_ids)
            )
        )
        for media_id, is_violation in vresult.all():
            violation_map[media_id] = violation_map.get(media_id, False) or is_violation

    items = []
    for media, full_name, username in rows:
        if violations_only and not violation_map.get(media.id, False):
            continue
        kind = "images" if media.source_type == DetectionSource.image else "videos"
        items.append(MediaAssetOut(
            id=media.id,
            source_type=media.source_type,
            original_filename=media.original_filename,
            status=media.status,
            original_url=_url(media.original_storage_key, kind),
            processed_url=_url(media.result_storage_key, kind),
            uploaded_by=media.uploaded_by,
            uploader_name=full_name or username,
            created_at=media.created_at,
            is_violation=violation_map.get(media.id),
        ))

    return GalleryListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/{media_asset_id}/save", status_code=201)
async def save_to_gallery(
    media_asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaAsset).where(MediaAsset.id == media_asset_id))
    media = result.scalar_one_or_none()
    if media is None:
        raise HTTPException(status_code=404, detail="Media asset not found")
    if media.uploaded_by != user.id and user.role != UserRole.operator:
        raise HTTPException(status_code=403, detail="You can only save your own uploads to the gallery")

    existing = await db.execute(select(GalleryItem).where(GalleryItem.media_asset_id == media_asset_id))
    if existing.scalar_one_or_none():
        return {"message": "Already saved to gallery"}

    db.add(GalleryItem(media_asset_id=media_asset_id, saved_by=user.id))
    await db.commit()
    return {"message": "Saved to gallery"}


@router.delete("/{media_asset_id}", status_code=204)
async def delete_from_gallery(
    media_asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaAsset).where(MediaAsset.id == media_asset_id))
    media = result.scalar_one_or_none()
    if media is None:
        raise HTTPException(status_code=404, detail="Media asset not found")
    if media.uploaded_by != user.id and user.role != UserRole.operator:
        raise HTTPException(status_code=403, detail="You can only delete your own uploads")

    if media.original_storage_key:
        await storage.delete(media.original_storage_key)
    if media.result_storage_key:
        await storage.delete(media.result_storage_key)

    await db.delete(media)  # cascades to gallery_items, detection_results, violations
    await db.commit()
