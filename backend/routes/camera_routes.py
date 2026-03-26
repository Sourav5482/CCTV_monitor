import time

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sklearn.metrics.pairwise import cosine_similarity

from services.camera_service import (
    add_camera,
    get_camera,
    get_frame,
    get_stream,
    list_cameras,
    reconnect_camera,
    remove_camera,
    start_camera,
    stop_camera,
)
from services.face_recognition import _extract_embedding, _load_embeddings
from services.attendance_service import is_already_marked, mark_attendance
from services.alert_service import create_or_update_alert, save_alert_image
from services.auto_detect_service import (
    get_recent_events,
    is_auto_detect_running,
    start_auto_detect,
    stop_auto_detect,
)
from services.incident_service import get_recent_incidents, summarize_incidents
from utils.image_processing import detect_face

router = APIRouter(prefix="/cameras", tags=["cameras"])

ATTENDANCE_THRESHOLD = 0.68


# ── Pydantic models ────────────────────────────────────────────────
class CameraIn(BaseModel):
    camera_id: str
    name: str
    source: str          # RTSP URL, HTTP URL, or webcam index like "0"
    location: str = ""
    alarm_enabled: bool = True


# ── CRUD endpoints ─────────────────────────────────────────────────

# ── Auto-detect control (MUST be before /{camera_id} routes) ────────

@router.post("/auto-detect/start")
async def start_auto():
    """Start continuous face detection on all cameras."""
    start_auto_detect()
    return {"status": "running"}


@router.post("/auto-detect/stop")
async def stop_auto():
    """Stop continuous face detection."""
    stop_auto_detect()
    return {"status": "stopped"}


@router.get("/auto-detect/status")
async def auto_detect_status():
    """Check if auto-detect is running."""
    return {"running": is_auto_detect_running()}


@router.get("/auto-detect/events")
async def auto_detect_events(limit: int = Query(20, ge=1, le=100)):
    """Poll recent detection events from auto-detect worker."""
    events = get_recent_events(limit=limit)
    return {"count": len(events), "events": events}


@router.get("/incidents/summary")
async def incidents_summary():
    """Summarize persisted incident detections near all connected CCTV feeds."""
    return summarize_incidents(limit=200)


@router.get("/incidents/events")
async def incident_events(limit: int = Query(20, ge=1, le=100)):
    """Fetch recent persisted incident events with image metadata."""
    incidents = get_recent_incidents(limit=limit)
    return {"count": len(incidents), "incidents": incidents}


# ── Static-path routes (before wildcard /{camera_id}) ───────────────

@router.post("/test-url")
async def test_camera_url(body: CameraIn):
    """Quick test: try to open a camera URL and report success/failure."""
    src = body.source
    if src.isdigit():
        src_val = int(src)
    else:
        src_val = src

    cap = cv2.VideoCapture(src_val, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 8000)
    opened = cap.isOpened()
    frame_ok = False
    if opened:
        frame_ok, _ = cap.read()
    cap.release()
    return {
        "source": body.source,
        "opened": opened,
        "frame_read": bool(frame_ok),
        "message": "Stream is working!" if frame_ok else
                   "Opened but no frames" if opened else
                   "Could not connect — check URL, network, and that IP Webcam is running",
    }


@router.post("")
async def create_camera(body: CameraIn):
    """Register a new camera and start streaming from it."""
    doc = add_camera(
        camera_id=body.camera_id,
        name=body.name,
        source=body.source,
        location=body.location,
        alarm_enabled=body.alarm_enabled,
    )
    stream = get_stream(body.camera_id)
    doc["status"] = stream.status if stream else "offline"
    return doc


@router.get("")
async def get_cameras():
    """List all registered cameras with live status."""
    cams = list_cameras()
    return {"count": len(cams), "cameras": cams}


@router.get("/{camera_id}")
async def get_camera_detail(camera_id: str):
    cam = get_camera(camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    return cam


@router.delete("/{camera_id}")
async def delete_camera(camera_id: str):
    ok = remove_camera(camera_id)
    if not ok:
        raise HTTPException(404, "Camera not found")
    return {"status": "ok", "camera_id": camera_id}


@router.post("/{camera_id}/reconnect")
async def reconnect(camera_id: str):
    """Manually retry connecting an offline camera."""
    ok = reconnect_camera(camera_id)
    # Wait a moment for the background thread to attempt connection
    import asyncio
    await asyncio.sleep(3)
    cam = get_camera(camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    return {"status": cam.get("status", "offline"), **cam}


@router.post("/{camera_id}/stop")
async def stop(camera_id: str):
    """Turn off a camera stream without deleting the camera."""
    ok = stop_camera(camera_id)
    if not ok:
        raise HTTPException(404, "Camera not found")
    cam = get_camera(camera_id)
    return {"status": "offline", **(cam or {"camera_id": camera_id})}


@router.post("/{camera_id}/start")
async def start(camera_id: str):
    """Turn on a camera stream using its saved source."""
    ok = start_camera(camera_id)
    if not ok:
        raise HTTPException(404, "Camera not found")
    # Give the stream thread a moment to read the first frame
    import asyncio
    await asyncio.sleep(2)
    cam = get_camera(camera_id)
    return {"status": cam.get("status", "offline") if cam else "offline", **(cam or {"camera_id": camera_id})}


# ── Live MJPEG stream ──────────────────────────────────────────────

def _mjpeg_generator(camera_id: str):
    """Yield JPEG frames as a multipart MJPEG stream."""
    while True:
        frame = get_frame(camera_id)
        if frame is None:
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "No Signal", (200, 250),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
        )
        time.sleep(0.066)  # ~15 fps


@router.get("/{camera_id}/stream")
async def stream_camera(camera_id: str):
    """MJPEG stream endpoint — plug into an <img> src."""
    cam = get_camera(camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    return StreamingResponse(
        _mjpeg_generator(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Snapshot ────────────────────────────────────────────────────────

@router.get("/{camera_id}/snapshot")
async def camera_snapshot(camera_id: str):
    """Return a single JPEG snapshot from the camera."""
    frame = get_frame(camera_id)
    if frame is None:
        raise HTTPException(503, "No frame available from this camera")
    _, jpeg = cv2.imencode(".jpg", frame)
    return StreamingResponse(
        iter([jpeg.tobytes()]),
        media_type="image/jpeg",
    )


# ── Detect face from a live camera frame ────────────────────────────

@router.post("/{camera_id}/detect")
async def detect_from_camera(camera_id: str):
    """Grab the latest frame from a camera, run face detection + attendance."""
    frame = get_frame(camera_id)
    if frame is None:
        raise HTTPException(503, "No frame available from this camera")

    face = detect_face(frame)
    if face is None:
        return {"status": "no_face", "message": "No face detected in current frame."}

    query_embedding = np.array(_extract_embedding(face)).reshape(1, -1)

    records = _load_embeddings()
    if not records:
        return {"status": "Unknown Person", "message": "No trained faces available."}

    best_match = None
    best_score = -1.0
    for record in records:
        stored = np.array(record["face_embeddings"])
        sims = cosine_similarity(query_embedding, stored).flatten()
        mx = float(np.max(sims))
        if mx > best_score:
            best_score = mx
            best_match = record

    if best_match is None or best_score < ATTENDANCE_THRESHOLD:
        filename = save_alert_image(frame)
        embedding_list = query_embedding.flatten().tolist()
        alert = create_or_update_alert(camera_id=camera_id, image_filename=filename, embedding=embedding_list)
        return {"status": "Unknown Person", "alert_id": alert["_id"], "image_filename": filename}

    employee_id = best_match["employee_id"]
    name = best_match["name"]

    if is_already_marked(employee_id):
        return {"employee_id": employee_id, "name": name, "status": "Already Marked", "confidence": round(best_score, 4)}

    mark_attendance(employee_id=employee_id, name=name, camera_id=camera_id)
    return {"employee_id": employee_id, "name": name, "status": "Attendance Marked", "confidence": round(best_score, 4)}
