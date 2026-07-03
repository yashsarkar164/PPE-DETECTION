"""
Storage abstraction layer.

Every other module talks to `storage`, never to the filesystem or boto3
directly. This is what makes the local -> S3 migration a one-file change:
swap STORAGE_PROVIDER in .env, implement S3StorageBackend's TODOs, done.

A "storage_key" is a provider-agnostic relative path, e.g.
"images/2026/07/uuid.jpg". Locally it resolves under LOCAL_UPLOAD_DIR /
LOCAL_RESULTS_DIR; on S3 it would be the object key.
"""
import abc
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile

from core.config import get_settings

settings = get_settings()


class StorageBackend(abc.ABC):
    @abc.abstractmethod
    async def save_upload(self, file: UploadFile, subfolder: str) -> tuple[str, int]:
        """Persist an incoming upload. Returns (storage_key, size_bytes)."""

    @abc.abstractmethod
    async def save_bytes(self, data: bytes, subfolder: str, filename: str) -> str:
        """Persist raw bytes (e.g. a processed result). Returns storage_key."""

    @abc.abstractmethod
    def resolve_path(self, storage_key: str) -> str:
        """Return an absolute local path OR a signed/public URL, depending on backend."""

    @abc.abstractmethod
    async def delete(self, storage_key: str) -> None:
        ...


class LocalStorageBackend(StorageBackend):
    """Stores files on local disk under uploads/ and results/."""

    def __init__(self) -> None:
        self.upload_root = Path(settings.local_upload_dir)
        self.results_root = Path(settings.local_results_dir)
        self.upload_root.mkdir(parents=True, exist_ok=True)
        self.results_root.mkdir(parents=True, exist_ok=True)

    def _root_for(self, subfolder: str) -> Path:
        # subfolder like "uploads/images" or "results/videos"
        top = subfolder.split("/")[0]
        return self.upload_root if top == "uploads" else self.results_root

    async def save_upload(self, file: UploadFile, subfolder: str) -> tuple[str, int]:
        ext = Path(file.filename or "").suffix
        key_name = f"{uuid.uuid4()}{ext}"
        rel_dir = subfolder.split("/", 1)[1] if "/" in subfolder else ""
        root = self._root_for(subfolder)
        target_dir = root / rel_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / key_name

        size = 0
        async with aiofiles.open(target_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                await out.write(chunk)
                size += len(chunk)
        await file.seek(0)

        storage_key = f"{rel_dir}/{key_name}" if rel_dir else key_name
        return storage_key, size

    async def save_bytes(self, data: bytes, subfolder: str, filename: str) -> str:
        rel_dir = subfolder.split("/", 1)[1] if "/" in subfolder else ""
        root = self._root_for(subfolder)
        target_dir = root / rel_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / filename
        async with aiofiles.open(target_path, "wb") as out:
            await out.write(data)
        return f"{rel_dir}/{filename}" if rel_dir else filename

    def resolve_path(self, storage_key: str) -> str:
        # Try results first, then uploads (callers generally know which, but this is a safe fallback)
        results_path = self.results_root / storage_key
        if results_path.exists():
            return str(results_path)
        return str(self.upload_root / storage_key)

    async def delete(self, storage_key: str) -> None:
        for root in (self.upload_root, self.results_root):
            path = root / storage_key
            if path.exists():
                os.remove(path)


class S3StorageBackend(StorageBackend):
    """
    Placeholder for future migration. Implement using boto3/aioboto3:
      - save_upload / save_bytes -> s3_client.put_object(Bucket=..., Key=storage_key, Body=...)
      - resolve_path -> s3_client.generate_presigned_url(...) for temporary read access
      - delete -> s3_client.delete_object(...)
    Storage keys are already provider-agnostic relative paths, so no key
    format changes are needed when switching STORAGE_PROVIDER=s3.
    """

    def __init__(self) -> None:
        raise NotImplementedError(
            "S3StorageBackend is a scaffold for future migration. "
            "Implement with boto3 and set STORAGE_PROVIDER=s3 in .env."
        )

    async def save_upload(self, file: UploadFile, subfolder: str) -> tuple[str, int]:
        raise NotImplementedError

    async def save_bytes(self, data: bytes, subfolder: str, filename: str) -> str:
        raise NotImplementedError

    def resolve_path(self, storage_key: str) -> str:
        raise NotImplementedError

    async def delete(self, storage_key: str) -> None:
        raise NotImplementedError


def get_storage_backend() -> StorageBackend:
    if settings.storage_provider == "s3":
        return S3StorageBackend()
    return LocalStorageBackend()


storage = get_storage_backend()
