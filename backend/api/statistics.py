"""Dashboard summary + statistics/analytics routes (operator-only for full analytics)."""
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    CommonViolation,
    DashboardStats,
    DetectionResultOut,
    StatisticsResponse,
    TrendPoint,
)
from core.database import get_db
from core.deps import get_current_user, require_operator
from core.models import DetectionResult, DetectionSource, MediaAsset, User, UserRole, WebcamSession

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Operators see system-wide numbers; staff see only their own activity."""
    scope_filter = [] if user.role == UserRole.operator else [MediaAsset.uploaded_by == user.id]
    detection_scope_filter = [] if user.role == UserRole.operator else [DetectionResult.processed_by == user.id]

    images_q = select(func.count()).select_from(MediaAsset).where(
        MediaAsset.source_type == DetectionSource.image, *scope_filter
    )
    videos_q = select(func.count()).select_from(MediaAsset).where(
        MediaAsset.source_type == DetectionSource.video, *scope_filter
    )
    webcam_scope = [] if user.role == UserRole.operator else [WebcamSession.user_id == user.id]
    webcam_q = select(func.count()).select_from(WebcamSession).where(*webcam_scope)

    total_detections_q = select(func.count()).select_from(DetectionResult).where(*detection_scope_filter)
    violations_q = select(func.count()).select_from(DetectionResult).where(
        DetectionResult.is_violation.is_(True), *detection_scope_filter
    )

    total_images = (await db.execute(images_q)).scalar_one()
    total_videos = (await db.execute(videos_q)).scalar_one()
    total_webcam = (await db.execute(webcam_q)).scalar_one()
    total_detections = (await db.execute(total_detections_q)).scalar_one()
    violation_count = (await db.execute(violations_q)).scalar_one()

    compliance = round(100.0 * (total_detections - violation_count) / total_detections, 2) if total_detections else 100.0

    recent_q = (
        select(DetectionResult)
        .where(*detection_scope_filter)
        .order_by(DetectionResult.created_at.desc())
        .limit(10)
    )
    recent = (await db.execute(recent_q)).scalars().all()

    return DashboardStats(
        total_images_processed=total_images,
        total_videos_processed=total_videos,
        total_webcam_sessions=total_webcam,
        compliance_percentage=compliance,
        violation_count=violation_count,
        recent_activity=[DetectionResultOut.model_validate(r) for r in recent],
    )


async def _trend(db: AsyncSession, since: datetime, group_format: str) -> list[TrendPoint]:
    # group_format: 'day' | 'week' | 'month' -> passed to date_trunc
    query = (
        select(
            func.date_trunc(group_format, DetectionResult.created_at).label("bucket"),
            func.count().label("total"),
            func.count().filter(DetectionResult.is_violation.is_(True)).label("violations"),
        )
        .where(DetectionResult.created_at >= since)
        .group_by("bucket")
        .order_by("bucket")
    )
    rows = (await db.execute(query)).all()
    points = []
    for bucket, total, violations in rows:
        compliance = round(100.0 * (total - violations) / total, 2) if total else 100.0
        label = bucket.strftime("%b %d") if group_format != "month" else bucket.strftime("%b %Y")
        points.append(TrendPoint(label=label, total_detections=total, violation_count=violations, compliance_percentage=compliance))
    return points


@router.get("", response_model=StatisticsResponse)
async def statistics(user: User = Depends(require_operator), db: AsyncSession = Depends(get_db)):
    """Full analytics dashboard — operator only, per spec (staff cannot access system analytics)."""
    now = datetime.now(timezone.utc)

    daily = await _trend(db, now - timedelta(days=14), "day")
    weekly = await _trend(db, now - timedelta(weeks=12), "week")
    monthly = await _trend(db, now - timedelta(days=365), "month")

    # Most common violations: unnest missing_ppe JSONB arrays across all violation rows
    all_missing = (
        await db.execute(select(DetectionResult.missing_ppe).where(DetectionResult.is_violation.is_(True)))
    ).scalars().all()
    counter: Counter[str] = Counter()
    for items in all_missing:
        counter.update(items)
    most_common = [CommonViolation(item=item, count=count) for item, count in counter.most_common(10)]

    total_images = (
        await db.execute(select(func.count()).select_from(MediaAsset).where(MediaAsset.source_type == DetectionSource.image))
    ).scalar_one()
    total_videos = (
        await db.execute(select(func.count()).select_from(MediaAsset).where(MediaAsset.source_type == DetectionSource.video))
    ).scalar_one()
    avg_time = (
        await db.execute(select(func.avg(DetectionResult.processing_time_ms)))
    ).scalar_one()

    return StatisticsResponse(
        daily=daily,
        weekly=weekly,
        monthly=monthly,
        most_common_violations=most_common,
        total_images_processed=total_images,
        total_videos_processed=total_videos,
        average_processing_time_ms=round(float(avg_time), 2) if avg_time else 0.0,
    )
