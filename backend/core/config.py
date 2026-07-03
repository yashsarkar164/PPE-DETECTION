"""
Application configuration.

All settings are loaded from environment variables (see .env.example).
Using pydantic-settings means misconfiguration fails fast at startup
rather than surfacing as a confusing runtime error later.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://ppe_user:ppe_password@localhost:5432/ppe_detection"

    # JWT
    jwt_secret_key: str = "insecure-dev-key-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Model
    model_path: str = "models/iocl_ppe.pt"
    model_confidence_threshold: float = 0.5
    model_iou_threshold: float = 0.45
    device: str = "cpu"

    # Storage
    storage_provider: str = "local"  # 'local' | 's3'
    local_upload_dir: str = "uploads"
    local_results_dir: str = "results"
    max_upload_size_mb: int = 500

    # AWS (future)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = ""

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # App
    environment: str = "development"
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
