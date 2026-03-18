"""Suspicious movement detection service.

Uses OpenCV's built-in HOG people detector plus frame-difference motion scoring.
This provides a lightweight model-based movement detector without extra dependencies.
"""

import time

import cv2
import numpy as np

# Per-camera state to compare motion across frames
_prev_gray_by_camera: dict[str, np.ndarray] = {}
_last_alert_by_camera: dict[str, float] = {}

# Cooldown to avoid repeated alerts from the same movement burst
SUSPICIOUS_COOLDOWN_SEC = 20

# Thresholds tuned for 640x480-ish feeds; can be adjusted later
MIN_PERSON_AREA = 7000
MOTION_SCORE_THRESHOLD = 0.035

_hog = cv2.HOGDescriptor()
_hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())


def detect_suspicious_movement(camera_id: str, frame: np.ndarray) -> dict | None:
    """Return suspicious movement metadata if detected, else None.

    Detection logic:
    1) Detect persons using HOG+SVM.
    2) Compute frame-to-frame motion score.
    3) Trigger if there is person presence and significant motion.
    """
    now = time.time()
    if now - _last_alert_by_camera.get(camera_id, 0) < SUSPICIOUS_COOLDOWN_SEC:
        return None

    # Downscale a little for stable speed
    resized = cv2.resize(frame, (640, 480))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # Person detection model (OpenCV HOG)
    rects, _weights = _hog.detectMultiScale(
        resized,
        winStride=(8, 8),
        padding=(8, 8),
        scale=1.05,
    )
    person_boxes = []
    for (x, y, w, h) in rects:
        area = w * h
        if area >= MIN_PERSON_AREA:
            person_boxes.append((int(x), int(y), int(w), int(h)))

    if not person_boxes:
        _prev_gray_by_camera[camera_id] = gray
        return None

    # Motion score from frame differencing
    prev = _prev_gray_by_camera.get(camera_id)
    _prev_gray_by_camera[camera_id] = gray
    if prev is None:
        return None

    diff = cv2.absdiff(gray, prev)
    blur = cv2.GaussianBlur(diff, (5, 5), 0)
    _, th = cv2.threshold(blur, 25, 255, cv2.THRESH_BINARY)
    motion_ratio = float(np.count_nonzero(th)) / float(th.size)

    if motion_ratio < MOTION_SCORE_THRESHOLD:
        return None

    # Extra local motion check near person ROIs
    person_motion_values = []
    for x, y, w, h in person_boxes:
        roi = th[y : y + h, x : x + w]
        if roi.size == 0:
            continue
        person_motion_values.append(float(np.count_nonzero(roi)) / float(roi.size))

    person_motion = max(person_motion_values) if person_motion_values else motion_ratio

    _last_alert_by_camera[camera_id] = now
    return {
        "model": "opencv_hog_motion",
        "person_count": len(person_boxes),
        "motion_score": round(motion_ratio, 5),
        "person_motion_score": round(person_motion, 5),
        "boxes": person_boxes[:5],
    }
