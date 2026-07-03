"""Violations review routes — a dedicated page to review every logged PPE violation."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import ViolationListResponse, ViolationOut, ViolationReviewRequest
from core.database import get_db
from core.deps import get_current_user
from core.models import DetectionSource, User, UserRole, Violation

router = APIRouter(prefix="/api/violations", tags=["violations"])


@router.get("", response_model=ViolationListResponse)
async def list_violations(
    source_type: DetectionSource | None = None,
    reviewed: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Violation)
    count_query = select(func.count()).select_from(Violation)

    if user.role != UserRole.operator:
        query = query.where(Violation.reported_by == user.id)
        count_query = count_query.where(Violation.reported_by == user.id)

    if source_type:
        query = query.where(Violation.source_type == source_type)
        count_query = count_query.where(Violation.source_type == source_type)
    if reviewed is not None:
        query = query.where(Violation.reviewed == reviewed)
        count_query = count_query.where(Violation.reviewed == reviewed)

    total = (await db.execute(count_query)).scalar_one()
    query = query.order_by(Violation.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()

    return ViolationListResponse(
        items=[ViolationOut.model_validate(v) for v in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{violation_id}/review", response_model=ViolationOut)
async def review_violation(
    violation_id: uuid.UUID,
    payload: ViolationReviewRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Violation).where(Violation.id == violation_id))
    violation = result.scalar_one_or_none()
    if violation is None:
        raise HTTPException(status_code=404, detail="Violation not found")

    violation.reviewed = payload.reviewed
    violation.notes = payload.notes
    violation.reviewed_by = user.id
    violation.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(violation)
    return ViolationOut.model_validate(violation)
