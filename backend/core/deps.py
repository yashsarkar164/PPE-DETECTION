"""
FastAPI dependencies for authentication and role-based access control.

Usage:
    @router.get("/analytics")
    async def analytics(user: User = Depends(require_operator)):
        ...
"""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import User, UserRole
from core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def require_operator(user: User = Depends(get_current_user)) -> User:
    """Operator-only routes: analytics, staff management, full detection history."""
    if user.role != UserRole.operator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires operator privileges.",
        )
    return user
