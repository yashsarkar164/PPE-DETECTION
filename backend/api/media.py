"""
Serves uploaded/processed media files.

While STORAGE_PROVIDER=local, this streams the file directly from disk.
When migrated to S3, this route would instead issue a 302 redirect to a
presigned URL from storage.resolve_path() — the frontend's <img>/<video>
src pointing at /api/media/... never has to change.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from core.deps import get_current_user
from core.models import User
from services.storage_service import storage

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/{kind}/{storage_key:path}")
async def get_media(kind: str, storage_key: str, user: User = Depends(get_current_user)):
    if kind not in {"images", "videos"}:
        raise HTTPException(status_code=404, detail="Unknown media kind")

    full_key = f"{kind}/{storage_key}" if not storage_key.startswith(kind) else storage_key
    path = storage.resolve_path(full_key)

    import os
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path)
