"""Pydantic request/response models for all API endpoints."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from core.models import DetectionSource, ProcessingStatus, UserRole


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

class DetectedObject(BaseModel):
    class_: str = Field(alias="class")
    confidence: float
    bbox: list[float] | None = None

    model_config = {"populate_by_name": True}


class DetectionResultOut(BaseModel):
    id: uuid.UUID
    media_asset_id: uuid.UUID | None
    source_type: DetectionSource
    detected_objects: list[dict[str, Any]]
    missing_ppe: list[str]
    is_violation: bool
    violation_confidence: float | None
    person_count: int
    processing_time_ms: int | None
    model_version: str | None
    processed_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageDetectionResponse(BaseModel):
    media_asset_id: uuid.UUID
    detection: DetectionResultOut
    original_url: str
    processed_url: str


class VideoDetectionResponse(BaseModel):
    media_asset_id: uuid.UUID
    detection: DetectionResultOut
    original_url: str
    processed_url: str
    status: ProcessingStatus


class WebcamFrameResponse(BaseModel):
    detected_objects: list[dict[str, Any]]
    missing_ppe: list[str]
    is_violation: bool
    violation_confidence: float | None
    person_count: int
    processing_time_ms: int
    annotated_frame_base64: str  # data:image/jpeg;base64,...


class WebcamSessionStartResponse(BaseModel):
    session_id: uuid.UUID
    started_at: datetime


class WebcamSessionEndRequest(BaseModel):
    frame_count: int
    violation_count: int
    avg_fps: float | None = None


# ---------------------------------------------------------------------------
# Gallery
# ---------------------------------------------------------------------------

class MediaAssetOut(BaseModel):
    id: uuid.UUID
    source_type: DetectionSource
    original_filename: str
    status: ProcessingStatus
    original_url: str
    processed_url: str | None
    uploaded_by: uuid.UUID
    uploader_name: str | None = None
    created_at: datetime
    is_violation: bool | None = None

    model_config = {"from_attributes": True}


class GalleryListResponse(BaseModel):
    items: list[MediaAssetOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_images_processed: int
    total_videos_processed: int
    total_webcam_sessions: int
    compliance_percentage: float
    violation_count: int
    recent_activity: list[DetectionResultOut]


class TrendPoint(BaseModel):
    label: str
    total_detections: int
    violation_count: int
    compliance_percentage: float


class CommonViolation(BaseModel):
    item: str
    count: int


class StatisticsResponse(BaseModel):
    daily: list[TrendPoint]
    weekly: list[TrendPoint]
    monthly: list[TrendPoint]
    most_common_violations: list[CommonViolation]
    total_images_processed: int
    total_videos_processed: int
    average_processing_time_ms: float


# ---------------------------------------------------------------------------
# Violations
# ---------------------------------------------------------------------------

class ViolationOut(BaseModel):
    id: uuid.UUID
    detection_result_id: uuid.UUID
    media_asset_id: uuid.UUID | None
    missing_ppe: list[str]
    confidence: float | None
    source_type: DetectionSource
    reviewed: bool
    reported_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ViolationListResponse(BaseModel):
    items: list[ViolationOut]
    total: int
    page: int
    page_size: int


class ViolationReviewRequest(BaseModel):
    reviewed: bool
    notes: str | None = None


# ---------------------------------------------------------------------------
# User management (operator only)
# ---------------------------------------------------------------------------

class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)
    full_name: str | None = None
    role: UserRole = UserRole.staff


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None
