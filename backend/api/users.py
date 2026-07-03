"""
User management routes — operator only.

Per spec there is no self-service registration; operators manage staff
accounts directly, and both roles' credentials otherwise come from the DB
seed. Operators cannot demote/deactivate themselves via this API to avoid
accidental lockout — do that directly in the database if truly needed.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import UserCreateRequest, UserOut, UserUpdateRequest
from core.database import get_db
from core.deps import require_operator
from core.models import User
from core.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(user: User = Depends(require_operator), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreateRequest,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    new_user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return UserOut.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
):
    if user_id == user.id and (payload.is_active is False or payload.role is not None):
        raise HTTPException(status_code=400, detail="You cannot change your own role or deactivate your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        target.full_name = payload.full_name
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.role is not None:
        target.role = payload.role

    await db.commit()
    await db.refresh(target)
    return UserOut.model_validate(target)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(target)
    await db.commit()
