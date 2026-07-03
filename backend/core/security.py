"""
Password hashing and JWT access/refresh token utilities.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "role": role, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """Returns (raw_token, token_hash, expires_at). Store the hash, send the raw token to the client."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    jti = str(uuid.uuid4())
    payload = {"sub": user_id, "type": "refresh", "jti": jti, "exp": expire}
    raw_token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash, expire


def decode_token(token: str) -> dict:
    """Raises JWTError if invalid/expired — caller converts to HTTP 401."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
