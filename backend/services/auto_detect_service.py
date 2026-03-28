"""Continuous auto-detection worker.

Runs in a background thread, grabs the latest frame from every active camera
every SCAN_INTERVAL seconds, runs face detection + attendance / alert logic.
"""

import logging
import os
import threading
import time

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from services.face_recognition import _extract_embedding, _load_embeddings
from services.attendance_service import is_already_marked, mark_attendance
from services.alert_service import create_or_update_alert, save_alert_image
from services.incident_service import log_suspicious_incident
from services.partial_face_theft_service import detect_partial_face_theft
from services.notification_service import enqueue_partial_face_alert, start_notification_worker, stop_notification_worker
from utils.image_processing import detect_face

logger = logging.getLogger("auto_detect")

SCAN_INTERVAL = float(os.getenv("AUTO_SCAN_INTERVAL", "1.0"))  # seconds between scans per camera
ATTENDANCE_THRESHOLD = 0.68  # higher = stricter matching, fewer false positives
EVENT_COOLDOWN = 60         # suppress repeated events for same person+camera (seconds)
PROCESS_EVERY_N_FRAMES = int(os.getenv("AUTO_PROCESS_EVERY_N", "1"))  # skip-frame optimization

_running = False
_thread: threading.Thread | None = None

# Recent detections pushed here so the frontend can poll them
_recent_events: list[dict] = []
_events_lock = threading.Lock()
MAX_EVENTS = 100

# Cooldown tracker: (camera_id, employee_id_or_"unknown") -> last_event_timestamp
_last_event: dict[tuple[str, str], float] = {}
_frame_counter: dict[str, int] = {}


def _push_event(event: dict):
    with _events_lock:
        _recent_events.insert(0, event)
        if len(_recent_events) > MAX_EVENTS:
            _recent_events.pop()


def get_recent_events(limit: int = 20) -> list[dict]:
    with _events_lock:
        return list(_recent_events[:limit])


def clear_events():
    with _events_lock:
        _recent_events.clear()


def _process_frame(camera_id: str, camera_name: str, frame: np.ndarray):
    """Run face detection + attendance/alert on a single frame."""
    face = detect_face(frame)
    if face is None:
        return  # no face — skip silently

    try:
        query_embedding = np.array(_extract_embedding(face)).reshape(1, -1)
    except Exception:
        return

    records = _load_embeddings()
    if not records:
        # No trained faces — every face is unknown
        filename = save_alert_image(frame)
        embedding_list = query_embedding.flatten().tolist()
        alert = create_or_update_alert(camera_id=camera_id, image_filename=filename, embedding=embedding_list)
        log_suspicious_incident(
            camera_id=camera_id,
            camera_name=camera_name,
            image_filename=filename,
            incident_type="unknown_person",
            metadata={"reason": "no_trained_faces", "alert_id": alert["_id"]},
        )
        _push_event({"camera_id": camera_id, "status": "Unknown Person", "alert_id": alert["_id"]})
        return

    best_match = None
    best_score = -1.0
    for record in records:
        stored = np.array(record["face_embeddings"])
        sims = cosine_similarity(query_embedding, stored).flatten()
        mx = float(np.max(sims))
        if mx > best_score:
            best_score = mx
            best_match = record

    now = time.time()

    if best_match is None or best_score < ATTENDANCE_THRESHOLD:
        # Always capture image into alert (for evidence collection)
        filename = save_alert_image(frame)
        embedding_list = query_embedding.flatten().tolist()
        alert = create_or_update_alert(camera_id=camera_id, image_filename=filename, embedding=embedding_list)
        log_suspicious_incident(
            camera_id=camera_id,
            camera_name=camera_name,
            image_filename=filename,
            incident_type="unknown_person",
            metadata={
                "reason": "unknown_person",
                "score": round(best_score, 4),
                "threshold": ATTENDANCE_THRESHOLD,
                "alert_id": alert["_id"],
            },
        )
        # Only push UI event on cooldown to avoid notification spam
        key = (camera_id, "unknown")
        if now - _last_event.get(key, 0) >= EVENT_COOLDOWN:
            _last_event[key] = now
            _push_event({"camera_id": camera_id, "status": "Unknown Person", "alert_id": alert["_id"]})
        return

    employee_id = best_match["employee_id"]
    name = best_match["name"]

    # Cooldown: don't push repeated events for the same person on same camera
    key = (camera_id, employee_id)
    if now - _last_event.get(key, 0) < EVENT_COOLDOWN:
        return
    _last_event[key] = now

    if is_already_marked(employee_id):
        _push_event({
            "camera_id": camera_id, "status": "Already Marked",
            "employee_id": employee_id, "name": name,
            "confidence": round(best_score, 4),
        })
        return

    mark_attendance(employee_id=employee_id, name=name, camera_id=camera_id)
    _push_event({
        "camera_id": camera_id, "status": "Attendance Marked",
        "employee_id": employee_id, "name": name,
        "confidence": round(best_score, 4),
    })


def _scan_loop():
    """Main loop — iterate over all active cameras, process one frame each."""
    from services.camera_service import _streams, get_camera  # import here to avoid circular

    while _running:
        for camera_id, stream in list(_streams.items()):
            if not _running:
                break
            if not stream.is_alive or stream.status != "active":
                continue
            frame = stream.frame
            if frame is None:
                continue
            try:
                frame_count = _frame_counter.get(camera_id, 0) + 1
                _frame_counter[camera_id] = frame_count
                if frame_count % PROCESS_EVERY_N_FRAMES != 0:
                    continue

                cam_cfg = get_camera(camera_id) or {}
                alarm_enabled = bool(cam_cfg.get("alarm_enabled", True))

                # Rule:
                # - Alarm OFF camera  -> run partial-face theft detection
                # - Alarm ON camera   -> no suspicious-movement logging (disabled)

                if not alarm_enabled:
                    # Alarm OFF: theft / concealment monitoring only
                    theft_incident = detect_partial_face_theft(camera_id, stream.name or camera_id, frame)
                    if theft_incident is not None:
                        log_suspicious_incident(
                            camera_id=camera_id,
                            camera_name=stream.name or camera_id,
                            image_filename=theft_incident["image_filename"],
                            incident_type="theft_partial_face",
                            metadata={
                                "reason": theft_incident["reason"],
                                "confidence": theft_incident["confidence"],
                                "person_confidence": theft_incident["person_confidence"],
                                "partial_face_confidence": theft_incident["partial_face_confidence"],
                                "streak": theft_incident["streak"],
                                "required_streak": theft_incident["required_streak"],
                                "bbox": theft_incident["bbox"],
                                "detector": theft_incident["detector"],
                                "person_crop_filename": theft_incident["person_crop_filename"],
                                "alarm_enabled": False,
                            },
                        )
                        _push_event({
                            "camera_id": camera_id,
                            "status": "Partial Face Detected",
                            "confidence": theft_incident["confidence"],
                            "reason": theft_incident["reason"],
                            "image_filename": theft_incident["image_filename"],
                        })
                        enqueue_partial_face_alert(theft_incident)
                        continue

                _process_frame(camera_id, stream.name or camera_id, frame)
            except Exception as exc:
                logger.warning("Auto-detect error on %s: %s", camera_id, exc)
        # Wait before next round
        time.sleep(SCAN_INTERVAL)


def start_auto_detect():
    global _running, _thread
    if _running:
        return
    start_notification_worker()
    _running = True
    _thread = threading.Thread(target=_scan_loop, daemon=True, name="auto-detect")
    _thread.start()
    logger.info("Auto-detect worker started (interval=%ss)", SCAN_INTERVAL)


def stop_auto_detect():
    global _running, _thread
    _running = False
    if _thread:
        _thread.join(timeout=5)
        _thread = None
    stop_notification_worker()
    logger.info("Auto-detect worker stopped")


def is_auto_detect_running() -> bool:
    return _running
