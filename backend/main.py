import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ensure the backend package root is on sys.path so absolute imports work
# regardless of the working directory used to launch uvicorn.
sys.path.insert(0, os.path.dirname(__file__))

from database import close_connection, get_alerts_collection, get_attendance_collection, get_cameras_collection, get_employees_collection, get_incidents_collection  # noqa: E402
from routes.face_routes import router as face_router  # noqa: E402
from routes.attendance_routes import router as attendance_router  # noqa: E402
from routes.alert_routes import router as alert_router  # noqa: E402
from routes.camera_routes import router as camera_router  # noqa: E402
from services.camera_service import start_all_cameras, stop_all_cameras  # noqa: E402
from services.auto_detect_service import start_auto_detect, stop_auto_detect  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure MongoDB indexes
    get_employees_collection().create_index("employee_id", unique=True)
    att = get_attendance_collection()
    att.create_index([("employee_id", 1), ("date", 1)])
    get_alerts_collection().create_index("timestamp")
    get_cameras_collection().create_index("camera_id", unique=True)
    get_incidents_collection().create_index("timestamp")
    # Ensure alerts_images directory exists
    os.makedirs(os.path.join(os.path.dirname(__file__), "alerts_images"), exist_ok=True)
    # Start all registered camera streams
    start_all_cameras()
    # Start continuous auto-detection on all cameras
    start_auto_detect()
    yield
    # Shutdown: stop auto-detect, camera streams, and close MongoDB
    stop_auto_detect()
    stop_all_cameras()
    close_connection()


app = FastAPI(
    title="Face Recognition API",
    description="Backend for training and recognizing faces via webcam images.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face_router)
app.include_router(attendance_router)
app.include_router(alert_router)
app.include_router(camera_router)

# Serve saved alert images as static files
app.mount("/alerts_images", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "alerts_images")), name="alerts_images")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
