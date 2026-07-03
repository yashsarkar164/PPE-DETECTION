"""Authentication routes: login, refresh, logout, password change."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserOut,
)
from core.database import get_db
from core.deps import get_current_user
from core.models import RefreshToken, User
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")

    access_token = create_access_token(str(user.id), user.role.value)
    raw_refresh, refresh_hash, expires_at = create_refresh_token(str(user.id))

    db.add(RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=expires_at))
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    token_hash = hash_token(payload.refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if stored is None or stored.revoked or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token is invalid or has been revoked")

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate: revoke old, issue new
    stored.revoked = True
    new_access = create_access_token(str(user.id), user.role.value)
    new_raw_refresh, new_hash, new_expires = create_refresh_token(str(user.id))
    db.add(RefreshToken(user_id=user.id, token_hash=new_hash, expires_at=new_expires))
    await db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_raw_refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_token(payload.refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True
        await db.commit()


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()
