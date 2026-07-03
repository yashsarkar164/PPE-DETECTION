"""
YOLOv8 PPE detection service.

Loads backend/models/iocl_ppe.pt exactly once at process startup and reuses
the in-memory model for every inference call (images, video frames, webcam
frames). Replacing the .pt file and restarting the service is all that's
needed to pick up a new model — no code changes required, because:

  1. Class names are read from the model itself (model.names), never
     hardcoded, so violation logic adapts to whatever classes the model
     was trained on.
  2. Violation logic is driven by a NO_<CLASS> naming convention: any class
     name starting with "NO-" or "NO_" (case-insensitive) is treated as a
     missing-PPE indicator. This matches common PPE dataset conventions
     (e.g. Hardhat / NO-Hardhat, Mask / NO-Mask, Safety Vest / NO-Safety Vest)
     without assuming a fixed label set.

No mock detection logic exists anywhere in this file or is used as a fallback.
If the model file is missing, the service raises at startup rather than
silently returning fake results.
"""
import logging
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from ultralytics import YOLO

from core.config import get_settings

logger = logging.getLogger("ppe.detection")
settings = get_settings()


class PPEDetectionService:
    def __init__(self, model_path: str) -> None:
        resolved = Path(model_path)
        if not resolved.exists():
            raise FileNotFoundError(
                f"YOLO model not found at '{model_path}'. Place your trained "
                f"iocl_ppe.pt at this path before starting the server."
            )
        logger.info("Loading YOLO model from %s ...", resolved)
        self.model = YOLO(str(resolved))
        self.model.to(settings.device)
        self.model_version = resolved.name
        self.class_names: dict[int, str] = self.model.names  # {0: "Hardhat", 1: "NO-Hardhat", ...}

        # Classes that indicate a PPE violation when detected
        self.violation_classes = {
            idx: name for idx, name in self.class_names.items()
            if name.strip().upper().replace("_", "-").startswith("NO-")
        }
        # Map a violation class back to the human-readable PPE item it's missing,
        # e.g. "NO-Hardhat" -> "Hardhat", "NO_Safety Vest" -> "Safety Vest"
        self.violation_to_item = {
            idx: name.split("-", 1)[-1].split("_", 1)[-1].strip().lstrip("-_ ")
            for idx, name in self.violation_classes.items()
        }
        self.person_class_indices = {
            idx for idx, name in self.class_names.items() if name.strip().lower() == "person"
        }

        logger.info("Model loaded. Classes: %s", self.class_names)
        logger.info("Violation classes detected: %s", self.violation_classes)

    # ------------------------------------------------------------------
    # Core inference
    # ------------------------------------------------------------------

    def infer(self, image: np.ndarray) -> dict[str, Any]:
        """
        Run inference on a single BGR image (as loaded by cv2).
        Returns a dict with detected_objects, missing_ppe, is_violation,
        violation_confidence, person_count, annotated_image, processing_time_ms.
        """
        start = time.perf_counter()

        results = self.model.predict(
            image,
            conf=settings.model_confidence_threshold,
            iou=settings.model_iou_threshold,
            verbose=False,
        )
        result = results[0]

        detected_objects: list[dict[str, Any]] = []
        missing_ppe: set[str] = set()
        violation_confidences: list[float] = []
        person_count = 0

        boxes = result.boxes
        if boxes is not None:
            for box in boxes:
                cls_idx = int(box.cls.item())
                confidence = float(box.conf.item())
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                class_name = self.class_names.get(cls_idx, f"class_{cls_idx}")

                detected_objects.append({
                    "class": class_name,
                    "confidence": round(confidence, 4),
                    "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                })

                if cls_idx in self.person_class_indices:
                    person_count += 1

                if cls_idx in self.violation_classes:
                    missing_ppe.add(self.violation_to_item[cls_idx])
                    violation_confidences.append(confidence)

        annotated = result.plot()  # BGR numpy array with boxes/labels drawn

        processing_time_ms = int((time.perf_counter() - start) * 1000)

        return {
            "detected_objects": detected_objects,
            "missing_ppe": sorted(missing_ppe),
            "is_violation": len(missing_ppe) > 0,
            "violation_confidence": round(max(violation_confidences), 4) if violation_confidences else None,
            "person_count": person_count,
            "annotated_image": annotated,
            "processing_time_ms": processing_time_ms,
            "model_version": self.model_version,
        }

    def infer_from_path(self, image_path: str) -> dict[str, Any]:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not read image at {image_path}")
        return self.infer(image)

    def infer_from_bytes(self, data: bytes) -> dict[str, Any]:
        arr = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Could not decode image bytes")
        return self.infer(image)

    # ------------------------------------------------------------------
    # Video processing
    # ------------------------------------------------------------------

    def infer_video(
        self,
        input_path: str,
        output_path: str,
        sample_every_n_frames: int = 1,
    ) -> dict[str, Any]:
        """
        Runs detection frame-by-frame over a video file, writes an annotated
        output video, and returns an aggregate summary (unique missing PPE
        items seen, violation frame count, per-frame results for the frame
        with the highest-confidence violation, total processing time).
        """
        start = time.perf_counter()
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video at {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        all_missing_ppe: set[str] = set()
        violation_frame_count = 0
        frame_idx = 0
        max_person_count = 0
        best_violation_conf = 0.0
        all_detected_classes: dict[str, int] = {}

        last_annotated = None
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_idx % sample_every_n_frames == 0:
                result = self.infer(frame)
                last_annotated = result["annotated_image"]
                max_person_count = max(max_person_count, result["person_count"])
                if result["is_violation"]:
                    violation_frame_count += 1
                    all_missing_ppe.update(result["missing_ppe"])
                    if result["violation_confidence"]:
                        best_violation_conf = max(best_violation_conf, result["violation_confidence"])
                for obj in result["detected_objects"]:
                    all_detected_classes[obj["class"]] = all_detected_classes.get(obj["class"], 0) + 1
            else:
                # Reuse the last annotated frame's boxes would require re-running;
                # simplest correct approach for skipped frames is to write the raw frame.
                last_annotated = frame

            writer.write(last_annotated)
            frame_idx += 1

        cap.release()
        writer.release()

        processing_time_ms = int((time.perf_counter() - start) * 1000)

        return {
            "detected_objects": [
                {"class": name, "occurrences": count} for name, count in all_detected_classes.items()
            ],
            "missing_ppe": sorted(all_missing_ppe),
            "is_violation": violation_frame_count > 0,
            "violation_confidence": round(best_violation_conf, 4) if best_violation_conf else None,
            "person_count": max_person_count,
            "processing_time_ms": processing_time_ms,
            "model_version": self.model_version,
            "total_frames": total_frames,
            "violation_frame_count": violation_frame_count,
            "fps": fps,
        }


_detection_service: PPEDetectionService | None = None


def get_detection_service() -> PPEDetectionService:
    """
    Lazily instantiate a process-wide singleton. Raises FileNotFoundError
    (surfaced as a 500 with a clear message) if the model file is absent —
    the app must never fall back to mock inference.
    """
    global _detection_service
    if _detection_service is None:
        _detection_service = PPEDetectionService(settings.model_path)
    return _detection_service
