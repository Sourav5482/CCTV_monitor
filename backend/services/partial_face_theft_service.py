"""Partial-face theft/concealment detection service.

Pipeline (all prebuilt models):
1) Person detection using YOLOv8 (Ultralytics) with OpenCV HOG fallback.
2) Face detection on each person ROI using Haar cascades.
3) If full face is absent but upper-face cues (eyes / landmarks) exist,
   classify as partial face visibility.
4) Trigger only after consecutive-frame persistence and confidence threshold.
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone

import cv2
import numpy as np

# Optional imports (service works with fallbacks if unavailable)
try:
    from ultralytics import YOLO  # type: ignore
except Exception:  # pragma: no cover
    YOLO = None

try:
    import mediapipe as mp  # type: ignore
except Exception:  # pragma: no cover
    mp = None

# Runtime configuration via env vars
PERSON_CONF_THRESHOLD = float(os.getenv("PARTIAL_FACE_PERSON_CONF", "0.45"))
PARTIAL_FACE_CONF_THRESHOLD = float(os.getenv("PARTIAL_FACE_CONF", "0.70"))
CONSECUTIVE_FRAMES_REQUIRED = int(os.getenv("PARTIAL_FACE_STREAK", "3"))
ALERT_COOLDOWN_SEC = int(os.getenv("PARTIAL_FACE_COOLDOWN", "45"))

# Evidence files are stored beside existing alert images
ALERTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alerts_images")

_yolo_model = None
_yolo_lock = threading.Lock()
_hog = cv2.HOGDescriptor()
_hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())


def _load_cascade(filename: str) -> cv2.CascadeClassifier:
    path = cv2.data.haarcascades + filename
    cascade = cv2.CascadeClassifier(path)
    return cascade


_face_cascade = _load_cascade("haarcascade_frontalface_default.xml")
_eye_cascade = _load_cascade("haarcascade_eye_tree_eyeglasses.xml")
_nose_cascade = _load_cascade("haarcascade_mcs_nose.xml")
_mouth_cascade = _load_cascade("haarcascade_smile.xml")

_camera_state: dict[str, dict] = {}
_state_lock = threading.Lock()

# Keep latest annotated frame for stream overlay endpoint
_annotated_frames: dict[str, np.ndarray] = {}
_annotated_lock = threading.Lock()

# Optional MediaPipe mesh for upper-face landmark cue
_face_mesh = None
if mp is not None:
    try:
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    except Exception:  # pragma: no cover
        _face_mesh = None


def _lazy_load_yolo():
    global _yolo_model
    if _yolo_model is not None or YOLO is None:
        return _yolo_model
    with _yolo_lock:
        if _yolo_model is None:
            _yolo_model = YOLO("yolov8n.pt")
    return _yolo_model


def _detect_persons(frame: np.ndarray) -> list[tuple[int, int, int, int, float, str]]:
    """Return list of (x1, y1, x2, y2, confidence, model_name)."""
    model = _lazy_load_yolo()
    h, w = frame.shape[:2]

    if model is not None:
        try:
            results = model(frame, verbose=False, conf=PERSON_CONF_THRESHOLD, classes=[0], imgsz=640)
            out: list[tuple[int, int, int, int, float, str]] = []
            for r in results:
                if r.boxes is None:
                    continue
                for b in r.boxes:
                    conf = float(b.conf.item())
                    if conf < PERSON_CONF_THRESHOLD:
                        continue
                    x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w - 1, x2), min(h - 1, y2)
                    if x2 <= x1 or y2 <= y1:
                        continue
                    out.append((x1, y1, x2, y2, conf, "yolov8n"))
            return out
        except Exception:
            # Fall through to HOG fallback
            pass

    # OpenCV HOG fallback: use conservative pseudo confidence
    rects, _ = _hog.detectMultiScale(frame, winStride=(8, 8), padding=(8, 8), scale=1.05)
    out = []
    for (x, y, bw, bh) in rects:
        if bw * bh < 7000:
            continue
        x1, y1 = max(0, int(x)), max(0, int(y))
        x2, y2 = min(w - 1, int(x + bw)), min(h - 1, int(y + bh))
        out.append((x1, y1, x2, y2, 0.75, "opencv_hog"))
    return out


def _has_upper_landmarks(roi_bgr: np.ndarray) -> bool:
    if _face_mesh is None:
        return False
    try:
        rgb = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2RGB)
        res = _face_mesh.process(rgb)
        if not res.multi_face_landmarks:
            return False
        lm = res.multi_face_landmarks[0].landmark
        # Eye landmarks (left/right) as upper-face cues
        idxs = [33, 133, 159, 145, 362, 263, 386, 374]
        return all(0 <= i < len(lm) for i in idxs)
    except Exception:
        return False


def _safe_detect(cascade: cv2.CascadeClassifier, image: np.ndarray, **kwargs):
    if cascade is None or cascade.empty():
        return []
    try:
        return cascade.detectMultiScale(image, **kwargs)
    except Exception:
        return []


def _analyze_face_visibility(person_roi: np.ndarray) -> dict:
    """Detect full-face vs partial-face cues inside a person ROI."""
    if person_roi.size == 0:
        return {
            "full_face": False,
            "eyes_detected": False,
            "upper_landmarks": False,
            "lower_features_missing": True,
            "partial": False,
            "confidence": 0.0,
            "reason": "empty_roi",
        }

    gray = cv2.cvtColor(person_roi, cv2.COLOR_BGR2GRAY)

    faces = _safe_detect(_face_cascade, gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    h, w = gray.shape[:2]
    upper = gray[: max(1, int(h * 0.6)), :]
    lower = gray[min(h - 1, int(h * 0.35)) :, :]

    eyes = _safe_detect(_eye_cascade, upper, scaleFactor=1.08, minNeighbors=4, minSize=(14, 14))
    noses = _safe_detect(_nose_cascade, lower, scaleFactor=1.1, minNeighbors=4, minSize=(18, 18))
    mouths = _safe_detect(_mouth_cascade, lower, scaleFactor=1.3, minNeighbors=12, minSize=(22, 14))

    has_face_box = len(faces) > 0
    eye_count = int(len(eyes))
    eyes_detected = eye_count > 0
    # Landmark pass is intentionally disabled for real-time performance.
    # Current rule is strict eye-visible + lower-face-missing detection.
    upper_landmarks = False
    lower_missing = len(noses) == 0 and len(mouths) == 0

    # Strict rule requested: partial-face alert only when eyes are visible
    # while lower-face cues are missing (e.g., cloth mask/cover).
    partial = bool(eyes_detected and lower_missing)
    full_face = bool(has_face_box and not lower_missing)

    if full_face and not partial:
        return {
            "full_face": True,
            "eyes_detected": eyes_detected,
            "upper_landmarks": upper_landmarks,
            "lower_features_missing": lower_missing,
            "partial": False,
            "confidence": 0.0,
            "reason": "full_face_visible",
        }

    if partial:
        # Two-eye detections are more reliable; one-eye still supported for side angles.
        confidence = 0.92 if eye_count >= 2 else 0.78
    else:
        confidence = 0.0

    reason = "no_partial_cue"
    if partial and eyes_detected and lower_missing:
        reason = "eyes_visible_lower_face_hidden"

    return {
        "full_face": False,
        "eyes_detected": eyes_detected,
        "upper_landmarks": upper_landmarks,
        "lower_features_missing": lower_missing,
        "partial": partial,
        "confidence": float(confidence),
        "reason": reason,
    }


def _save_evidence(camera_id: str, frame: np.ndarray, person_crop: np.ndarray) -> dict:
    os.makedirs(ALERTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    base = f"partial_face_{camera_id}_{stamp}"
    frame_filename = f"{base}_frame.jpg"
    crop_filename = f"{base}_crop.jpg"

    cv2.imwrite(os.path.join(ALERTS_DIR, frame_filename), frame)
    if person_crop.size > 0:
        cv2.imwrite(os.path.join(ALERTS_DIR, crop_filename), person_crop)
    else:
        crop_filename = ""

    return {
        "frame_filename": frame_filename,
        "person_crop_filename": crop_filename,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def set_latest_annotated_frame(camera_id: str, frame: np.ndarray):
    with _annotated_lock:
        _annotated_frames[camera_id] = frame.copy()


def get_latest_annotated_frame(camera_id: str) -> np.ndarray | None:
    with _annotated_lock:
        frame = _annotated_frames.get(camera_id)
        return frame.copy() if frame is not None else None


def detect_partial_face_theft(camera_id: str, camera_name: str, frame: np.ndarray) -> dict | None:
    """Analyze one frame and return incident payload when alert condition is met.

    Alert condition:
    - Person detected with confidence >= PERSON_CONF_THRESHOLD
    - Partial face cue confidence >= PARTIAL_FACE_CONF_THRESHOLD
    - Condition persists for CONSECUTIVE_FRAMES_REQUIRED
    """
    persons = _detect_persons(frame)
    annotated = frame.copy()

    best_partial = None

    for x1, y1, x2, y2, p_conf, det_model in persons:
        roi = frame[y1:y2, x1:x2]
        visibility = _analyze_face_visibility(roi)

        label = f"Person {p_conf:.2f}"
        color = (59, 130, 246)

        if visibility["full_face"]:
            label = f"Full Face Visible {p_conf:.2f}"
            color = (34, 197, 94)
        elif visibility["partial"]:
            # Favor visibility cues over person confidence so partial-face alerts
            # can still trigger when person detector confidence is moderate.
            score = min(0.99, (p_conf * 0.35) + (visibility["confidence"] * 0.65))
            if best_partial is None or score > best_partial["score"]:
                best_partial = {
                    "box": (x1, y1, x2, y2),
                    "person_confidence": p_conf,
                    "partial_confidence": visibility["confidence"],
                    "score": float(score),
                    "reason": visibility["reason"],
                    "detector": det_model,
                    "camera_name": camera_name,
                }
            label = f"Partial Face {score:.2f}"
            color = (0, 165, 255)

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            annotated,
            label,
            (x1, max(20, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
            cv2.LINE_AA,
        )

    with _state_lock:
        state = _camera_state.setdefault(camera_id, {"streak": 0, "last_alert_ts": 0.0})
        if best_partial and best_partial["score"] >= PARTIAL_FACE_CONF_THRESHOLD:
            state["streak"] += 1
        else:
            state["streak"] = 0

        streak = int(state["streak"])
        best_score = float(best_partial["score"]) if best_partial else 0.0

        cv2.putText(
            annotated,
            f"Partial-face streak: {streak}/{CONSECUTIVE_FRAMES_REQUIRED}",
            (14, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 165, 255),
            2,
            cv2.LINE_AA,
        )

        set_latest_annotated_frame(camera_id, annotated)

        now = time.time()
        should_alert = (
            best_partial is not None
            and best_score >= PARTIAL_FACE_CONF_THRESHOLD
            and streak >= CONSECUTIVE_FRAMES_REQUIRED
            and (now - float(state["last_alert_ts"])) >= ALERT_COOLDOWN_SEC
        )

        if not should_alert:
            return None

        state["last_alert_ts"] = now

    x1, y1, x2, y2 = best_partial["box"]
    crop = frame[y1:y2, x1:x2].copy()
    evidence = _save_evidence(camera_id, annotated, crop)

    return {
        "incident_type": "theft_partial_face",
        "camera_id": camera_id,
        "camera_name": camera_name,
        "label": "Partial Face Detected",
        "confidence": round(best_score, 4),
        "person_confidence": round(best_partial["person_confidence"], 4),
        "partial_face_confidence": round(best_partial["partial_confidence"], 4),
        "streak": streak,
        "required_streak": CONSECUTIVE_FRAMES_REQUIRED,
        "bbox": [x1, y1, x2, y2],
        "reason": best_partial["reason"],
        "detector": best_partial["detector"],
        "image_filename": evidence["frame_filename"],
        "person_crop_filename": evidence["person_crop_filename"],
        "timestamp": evidence["timestamp"],
    }
