"""
PPE Detection Management System — FastAPI backend entrypoint.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

The YOLO model (models/iocl_ppe.pt) is loaded once at startup via the
lifespan handler below. If it's missing, the app still starts (so /docs and
/health remain reachable for diagnostics) but every detection endpoint will
return a clear 500 error until a valid model is placed at that path.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import auth, detection, gallery, media, statistics, users, violations, webcam
from core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("ppe.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PPE Detection API (environment=%s)", settings.environment)
    try:
        from services.detection_service import get_detection_service
        service = get_detection_service()
        logger.info("YOLO model ready: %s | classes=%s", service.model_version, list(service.class_names.values()))
    except FileNotFoundError as exc:
        logger.warning(
            "%s Detection endpoints will fail until the model is in place. "
            "The rest of the API (auth, gallery, etc.) is still usable.",
            exc,
        )
    yield
    logger.info("Shutting down PPE Detection API")


app = FastAPI(
    title="PPE Detection Management System API",
    description="Backend for industrial PPE compliance detection (YOLOv8-powered).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(detection.router)
app.include_router(webcam.router)
app.include_router(gallery.router)
app.include_router(statistics.router)
app.include_router(violations.router)
app.include_router(users.router)
app.include_router(media.router)


@app.get("/health", tags=["health"])
async def health():
    model_status = "not_loaded"
    model_classes = []
    try:
        from services.detection_service import get_detection_service
        service = get_detection_service()
        model_status = "loaded"
        model_classes = list(service.class_names.values())
    except FileNotFoundError:
        pass

    return {
        "status": "ok",
        "environment": settings.environment,
        "model_status": model_status,
        "model_classes": model_classes,
    }
