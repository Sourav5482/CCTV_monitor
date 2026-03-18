# CCTV Face Recognition & Monitoring System

AI-powered employee monitoring system with real-time face recognition, automatic attendance marking, live CCTV camera feeds, unknown-person security alerts, and model-based suspicious movement detection.

![Tech](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Tech](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Tech](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Tech](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat&logo=opencv&logoColor=white)
![Tech](https://img.shields.io/badge/DeepFace-FF6F00?style=flat)

---

## Features

| Feature | Description |
|---------|-------------|
| **Face Registration** | Capture 200 webcam images, extract embeddings with DeepFace (Facenet), store in MongoDB |
| **Live CCTV Preview** | Connect webcams or IP cameras (RTSP/HTTP), view real-time MJPEG streams in a dedicated page |
| **Auto Attendance** | Camera scans faces every 2 seconds, auto-marks attendance when a registered employee is recognized |
| **Security Alerts** | Unknown persons trigger an alert with saved image, audio beep, and MongoDB record. Repeated detections of the same person are grouped under one alert |
| **CCTV Features Page** | Separate controls for auto-detect, incident summary, and live detection feed |
| **Suspicious Movement Detection** | OpenCV HOG person detector + frame-difference motion scoring captures suspicious movement with image and metadata |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Axios, react-webcam, react-router-dom, Recharts, Lucide icons |
| Backend | Python, FastAPI, DeepFace (Facenet model), OpenCV, NumPy, scikit-learn |
| Database | MongoDB (pymongo) |
| Streaming | OpenCV VideoCapture → MJPEG over HTTP |

---

## Project Structure

```
CCTVMAin/
├── backend/
│   ├── main.py                       # FastAPI app, lifespan, CORS, router registration
│   ├── database.py                   # MongoDB connection (employees, attendance, alerts, cameras, incidents)
│   ├── requirements.txt
│   ├── models/
│   │   └── face_embeddings.pkl       # Pickle cache of all face embeddings
│   ├── alerts_images/                # Saved unknown-person snapshots
│   ├── routes/
│   │   ├── face_routes.py            # POST /train-face, POST /recognize-face
│   │   ├── attendance_routes.py      # POST /detect-attendance, GET /attendance
│   │   ├── alert_routes.py           # GET /alerts, POST /alerts/handle/{id}
│   │   └── camera_routes.py          # CRUD /cameras, stream/snapshot, detect, auto-detect, incidents
│   ├── services/
│   │   ├── face_training.py          # Embedding extraction & DB storage
│   │   ├── face_recognition.py       # Embedding comparison & matching
│   │   ├── attendance_service.py     # Attendance record logic
│   │   ├── alert_service.py          # Alert creation, deduplication, handling
│   │   ├── camera_service.py         # OpenCV stream threads & camera management
│   │   ├── auto_detect_service.py    # Continuous scan loop (attendance + unknown + incidents)
│   │   ├── incident_service.py       # Incident persistence/summary
│   │   └── suspicious_motion_service.py # Model-based suspicious movement detection
│   └── utils/
│       └── image_processing.py       # Image decoding & Haar cascade face detection
│
└── frontend/
    └── src/
        ├── App.jsx                   # Router layout
        ├── main.jsx                  # Entry point
        ├── services/
        │   └── api.js                # All API calls (Axios)
        ├── components/
        │   ├── Sidebar.jsx           # Navigation sidebar
        │   ├── Navbar.jsx            # Top bar with search
        │   ├── CameraCard.jsx        # Live MJPEG camera card
        │   └── WebcamCapture.jsx     # Webcam preview component
        └── pages/
            ├── Landing.jsx           # Feature cards + quick navigation
            ├── RegisterFace.jsx      # Employee registration (200 auto-captures)
            ├── LiveCCTVPreview.jsx   # Camera management + live feed preview
            ├── CCTVFeatures.jsx      # Auto-detect controls + incident intelligence
            ├── CameraAttendance.jsx  # Live scan & auto-attendance
            ├── Attendance.jsx        # Attendance records, filters, CSV export
            └── Alerts.jsx            # Security alerts, dismiss/escalate, image gallery
```

---

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **MongoDB** running on `localhost:27017`

---

## Setup & Run

### 1. Install dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Start MongoDB

Make sure MongoDB is running locally. Or set a custom URI:

```bash
set MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/
```

### 3. Start the backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000` — Docs: `http://localhost:8000/docs`

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

Opens at `http://localhost:5173`

---

## How It Works

### Step 1 — Register Employees

1. Go to **Register Face** page
2. Enter employee name, ID, and phone number
3. Click **Start Capture** — the system auto-captures 200 webcam frames at 200ms intervals
4. Click **Train Model** — frames are sent to the backend, faces are detected (Haar cascade), and 128-dimensional embeddings are extracted (DeepFace Facenet)
5. Embeddings are stored in MongoDB (`employees` collection) and exported to `face_embeddings.pkl`

### Step 2 — Connect Cameras

1. Go to **Live CCTV Preview** page
2. Click **Add Camera** and fill in:

   | Field | Example | Description |
   |-------|---------|-------------|
   | Camera ID | `CAM-01` | Unique identifier |
   | Name | `Entrance Camera` | Display name |
   | Source | `0` | Webcam index (`0`, `1`) or RTSP URL |
   | Location | `Main Gate` | Optional |

3. Click **Connect Camera** — the backend opens an OpenCV `VideoCapture` in a background thread and starts reading frames
4. The live MJPEG feed appears instantly in the camera card

**Supported sources:**
- `0` / `1` — Local USB/laptop webcam
- `rtsp://user:pass@192.168.1.10:554/stream` — IP/CCTV camera
- `http://192.168.1.10:8080/video` — HTTP stream (e.g. IP Webcam app)

### Step 3 — Automatic Attendance

1. Go to **Camera Attendance** page
2. Turn on the camera and click **Start Attendance Scan**
3. The system captures a frame every 2 seconds and sends it to the backend
4. Each frame is compared against all stored embeddings using **cosine similarity (max score)**
5. If the best match is **>= 0.68**, attendance is marked automatically (once per day per employee)
6. If below threshold → the person is flagged as **unknown**

### Step 4 — Security Alerts + Incidents

When an unknown person is detected:

1. The frame is saved to `backend/alerts_images/`
2. A face embedding is extracted and compared to recent unhandled alerts (within 30 minutes)
3. If the face matches an existing alert → the image is **appended** to that alert (no duplicate)
4. If it's a new face → a **new alert** is created in MongoDB
5. The frontend plays an **audio beep** and shows a yellow notification
6. Admins can view all alerts on the **Security Alerts** page, view captured images, and **dismiss** or **escalate** each alert

Additionally, continuous monitoring in **CCTV Features** now logs incident events:

1. Frames are scanned continuously in the auto-detect worker
2. Suspicious movement is detected by a lightweight model pipeline:
    - OpenCV HOG person detector (person presence)
    - Frame-difference motion scoring (movement intensity)
3. When suspicious movement is detected, a frame image is saved and an incident record is written with:
    - camera_id, camera_name
    - timestamp/date
    - image_filename
    - metadata (model, person_count, motion_score, person_motion_score, bounding boxes)
4. Incident summary and recent captures are shown in the **CCTV Features** page

### Step 5 — View Records

- **View Attendance** — filter by date or employee ID, refresh, export to CSV
- **Security Alerts** — filter by status (unhandled/dismissed/escalated), view image gallery per alert

---

## API Reference

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### Face Training
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/train-face` | Register employee (name, employee_id, phone, images[]) |
| POST | `/recognize-face` | Identify person from single image |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/detect-attendance` | Detect face & mark attendance (image + camera_id) |
| GET | `/attendance` | List records (optional: ?date=YYYY-MM-DD&employee_id=X) |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts` | List alerts (optional: ?status=unhandled&limit=50) |
| POST | `/alerts/handle/{id}` | Mark alert as dismissed or escalated (?action=dismissed) |

### Cameras
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/cameras` | Add camera (camera_id, name, source, location) |
| GET | `/cameras` | List all cameras with live status |
| POST | `/cameras/test-url` | Validate stream source quickly |
| POST | `/cameras/auto-detect/start` | Start continuous auto-detection |
| POST | `/cameras/auto-detect/stop` | Stop continuous auto-detection |
| GET | `/cameras/auto-detect/status` | Auto-detect running status |
| GET | `/cameras/auto-detect/events` | Recent detection feed events |
| GET | `/cameras/incidents/summary` | Incident summary cards |
| GET | `/cameras/incidents/events` | Recent incident captures with metadata |
| GET | `/cameras/{id}` | Single camera detail |
| DELETE | `/cameras/{id}` | Remove camera |
| POST | `/cameras/{id}/reconnect` | Reconnect an offline camera |
| GET | `/cameras/{id}/stream` | Live MJPEG video stream |
| GET | `/cameras/{id}/snapshot` | Single JPEG frame |
| POST | `/cameras/{id}/detect` | Run face detection on current frame |

---

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `employees` | Employee profiles + face embedding arrays |
| `attendance` | Daily attendance records with timestamps |
| `alerts` | Unknown person alerts with images and embeddings |
| `cameras` | Registered camera configurations |
| `incidents` | Suspicious movement incidents with camera name/date/image metadata |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `face_recognition_db` | Database name |

---

## License

MIT
