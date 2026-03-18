"""Camera management service.

Manages connections to CCTV cameras (RTSP/HTTP streams) and local webcams
via OpenCV VideoCapture.  Each camera runs in its own daemon thread and
keeps the latest frame available for MJPEG streaming and face-detection.
"""

import threading
import time
from datetime import datetime, timezone

import cv2
import numpy as np

from database import get_cameras_collection

# ── Active camera streams keyed by camera_id ────────────────────────
_streams: dict[str, "CameraStream"] = {}
_lock = threading.Lock()


class CameraStream:
    """Wraps an OpenCV VideoCapture running in a background thread."""

    def __init__(self, camera_id: str, source: str | int, name: str = ""):
        self.camera_id = camera_id
        self.source = source
        self.name = name

        self._cap: cv2.VideoCapture | None = None
        self._frame: np.ndarray | None = None
        self._frame_lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._last_read_time: float = 0.0

    # ── lifecycle ────────────────────────────────────────────────────
    def _resolve_source(self):
        """Return int for local webcam index, else the raw URL string."""
        s = str(self.source).strip()
        return int(s) if s.isdigit() else s

    def _open_capture(self) -> cv2.VideoCapture | None:
        """Try to open the capture device with a timeout-friendly approach."""
        src = self._resolve_source()
        # For network streams, try multiple backends for best compatibility
        if isinstance(src, str):
            for backend in (cv2.CAP_FFMPEG, cv2.CAP_ANY):
                cap = cv2.VideoCapture(src, backend)
                # Set shorter timeouts (in ms) so it doesn't hang forever
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 10000)
                if cap.isOpened():
                    # Try to actually read one frame to be sure
                    ok, _ = cap.read()
                    if ok:
                        print(f"[camera] Connected to {self.camera_id} ({src}) via backend {backend}")
                        return cap
                cap.release()
            return None
        else:
            # On Windows, prefer DirectShow over MSMF to avoid grab errors
            for backend in (cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY):
                cap = cv2.VideoCapture(src, backend)
                if cap.isOpened():
                    # Set buffer size to 1 so we always get the latest frame
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    # Set resolution
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    ok, _ = cap.read()
                    if ok:
                        print(f"[camera] Webcam {self.camera_id} opened via backend {backend}")
                        return cap
                cap.release()
            return None

    def start(self) -> bool:
        """Start the camera thread (connects in background, non-blocking)."""
        if self._running:
            return True
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()
        return True

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        if self._cap:
            self._cap.release()
            self._cap = None

    def _read_loop(self):
        """Main camera loop — connects first, then reads frames continuously."""
        MAX_RETRIES = 5
        retries = 0

        while self._running:
            # ── Connect phase ──
            if self._cap is None or not self._cap.isOpened():
                print(f"[camera] Connecting to {self.camera_id} ({self.source})...")
                cap = self._open_capture()
                if cap is None:
                    retries += 1
                    if retries > MAX_RETRIES:
                        print(f"[camera] {self.camera_id}: giving up after {MAX_RETRIES} retries — will be retried by background loop")
                        self._running = False
                        return
                    # Wait before retrying (exponential backoff capped at 10s)
                    time.sleep(min(2 ** retries, 10))
                    continue
                self._cap = cap
                retries = 0

            # ── Read phase ──
            ok, frame = self._cap.read()
            if not ok:
                print(f"[camera] {self.camera_id}: lost connection, will reconnect...")
                self._cap.release()
                self._cap = None
                time.sleep(2)
                continue

            with self._frame_lock:
                self._frame = frame
                self._last_read_time = time.time()
            # ~15 fps — matches stream rate, avoids hammering the device
            time.sleep(0.066)

    # ── public accessors ─────────────────────────────────────────────
    @property
    def frame(self) -> np.ndarray | None:
        with self._frame_lock:
            return self._frame.copy() if self._frame is not None else None

    @property
    def is_alive(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    @property
    def status(self) -> str:
        if not self.is_alive:
            return "offline"
        if time.time() - self._last_read_time > 5:
            return "no_signal"
        return "active"


# ── CRUD helpers (MongoDB backed) ───────────────────────────────────

def add_camera(camera_id: str, name: str, source: str, location: str = "") -> dict:
    """Register a camera in the DB and start its stream."""
    col = get_cameras_collection()
    doc = {
        "camera_id": camera_id,
        "name": name,
        "source": source,           # RTSP URL, HTTP URL, or device index ("0")
        "location": location,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    col.update_one({"camera_id": camera_id}, {"$set": doc}, upsert=True)
    _start_stream(camera_id, source, name)
    return doc


def remove_camera(camera_id: str) -> bool:
    col = get_cameras_collection()
    result = col.delete_one({"camera_id": camera_id})
    _stop_stream(camera_id)
    return result.deleted_count == 1


def list_cameras() -> list[dict]:
    """List all registered cameras with their live status."""
    cams = list(get_cameras_collection().find({}, {"_id": 0}))
    for cam in cams:
        cid = cam["camera_id"]
        stream = _streams.get(cid)
        cam["status"] = stream.status if stream else "offline"
    return cams


def get_camera(camera_id: str) -> dict | None:
    cam = get_cameras_collection().find_one({"camera_id": camera_id}, {"_id": 0})
    if cam:
        stream = _streams.get(camera_id)
        cam["status"] = stream.status if stream else "offline"
    return cam


# ── Stream management ─────────────────────────────────────────────

def _start_stream(camera_id: str, source: str, name: str = "") -> bool:
    with _lock:
        if camera_id in _streams:
            _streams[camera_id].stop()
        stream = CameraStream(camera_id, source, name)
        ok = stream.start()
        # Always store — offline cameras will be retried by the retry loop
        _streams[camera_id] = stream
        return ok


def _stop_stream(camera_id: str):
    with _lock:
        stream = _streams.pop(camera_id, None)
        if stream:
            stream.stop()


def get_stream(camera_id: str) -> CameraStream | None:
    return _streams.get(camera_id)


_retry_running = False
_retry_thread: threading.Thread | None = None


def _retry_loop():
    """Periodically attempt to reconnect offline cameras."""
    global _retry_running
    while _retry_running:
        time.sleep(10)  # check every 10 seconds
        with _lock:
            for stream in list(_streams.values()):
                if not stream.is_alive:
                    print(f"[camera] Retrying connection for {stream.camera_id}...")
                    stream.start()


def reconnect_camera(camera_id: str) -> bool:
    """Manually retry connecting a specific camera."""
    stream = _streams.get(camera_id)
    if not stream:
        # Reload from DB
        cam = get_cameras_collection().find_one({"camera_id": camera_id}, {"_id": 0})
        if not cam:
            return False
        return _start_stream(camera_id, cam["source"], cam.get("name", ""))
    if stream.is_alive:
        return True
    # Stop old thread and create a fresh stream
    stream.stop()
    return _start_stream(camera_id, str(stream.source), stream.name)


def start_all_cameras():
    """Load cameras from DB and start their streams (called on app start)."""
    global _retry_running, _retry_thread
    for cam in get_cameras_collection().find({}, {"_id": 0}):
        _start_stream(cam["camera_id"], cam["source"], cam.get("name", ""))
    # Start background retry loop for offline cameras
    _retry_running = True
    _retry_thread = threading.Thread(target=_retry_loop, daemon=True)
    _retry_thread.start()


def stop_all_cameras():
    """Stop every active stream (called on app shutdown)."""
    global _retry_running
    _retry_running = False
    with _lock:
        for stream in _streams.values():
            stream.stop()
        _streams.clear()


def get_frame(camera_id: str) -> np.ndarray | None:
    """Return the latest frame from the given camera, or None."""
    stream = _streams.get(camera_id)
    if stream:
        return stream.frame
    return None
