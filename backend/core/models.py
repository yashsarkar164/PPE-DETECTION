"""
SQLAlchemy ORM models mapped onto the schema defined in database/schema.sql.
Keep these two in sync when the schema changes.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class UserRole(str, enum.Enum):
    operator = "operator"
    staff = "staff"


class DetectionSource(str, enum.Enum):
    image = "image"
    video = "video"
    webcam = "webcam"


class ProcessingStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


user_role_enum = PGEnum(UserRole, name="user_role", create_type=False)
detection_source_enum = PGEnum(DetectionSource, name="detection_source", create_type=False)
processing_status_enum = PGEnum(ProcessingStatus, name="processing_status", create_type=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150))
    role: Mapped[UserRole] = mapped_column(user_role_enum, default=UserRole.staff, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    source_type: Mapped[DetectionSource] = mapped_column(detection_source_enum, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(20), default="local")
    original_storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    result_storage_key: Mapped[str | None] = mapped_column(String(500))
    thumbnail_storage_key: Mapped[str | None] = mapped_column(String(500))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[ProcessingStatus] = mapped_column(processing_status_enum, default=ProcessingStatus.pending)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    uploader: Mapped["User"] = relationship(foreign_keys=[uploaded_by])


class WebcamSession(Base):
    __tablename__ = "webcam_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    frame_count: Mapped[int] = mapped_column(Integer, default=0)
    violation_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_fps: Mapped[float | None] = mapped_column(Numeric(6, 2))


class DetectionResult(Base):
    __tablename__ = "detection_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    webcam_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("webcam_sessions.id", ondelete="CASCADE")
    )
    processed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    source_type: Mapped[DetectionSource] = mapped_column(detection_source_enum, nullable=False)
    detected_objects: Mapped[list] = mapped_column(JSONB, default=list)
    missing_ppe: Mapped[list] = mapped_column(JSONB, default=list)
    is_violation: Mapped[bool] = mapped_column(Boolean, default=False)
    violation_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    person_count: Mapped[int] = mapped_column(Integer, default=0)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer)
    model_version: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("detection_results.id", ondelete="CASCADE")
    )
    media_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE")
    )
    reported_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    missing_ppe: Mapped[list] = mapped_column(JSONB, default=list)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    source_type: Mapped[DetectionSource] = mapped_column(detection_source_enum, nullable=False)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GalleryItem(Base):
    __tablename__ = "gallery_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE"), unique=True
    )
    saved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
