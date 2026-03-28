# SudarshanAI Face Recognition and Monitoring System

Production-style full-stack CCTV monitoring platform with face registration, real-time attendance, unknown-person alerts, and suspicious movement incident tracking.

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat&logo=opencv&logoColor=white)
![DeepFace](https://img.shields.io/badge/DeepFace-FF6F00?style=flat)

## Highlights

- Face registration with webcam capture and embedding storage
- Live CCTV preview for webcam, RTSP, and HTTP streams
- Automatic attendance marking using face recognition
- Unknown-person security alerts with image evidence
- Suspicious movement incident detection and event feed
- Theft-concealment detection: YOLO person + partial-face visibility logic
- Unified React frontend for operations and monitoring

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Axios, Recharts, Lucide |
| Backend | FastAPI, OpenCV, DeepFace, NumPy, scikit-learn |
| Database | MongoDB (pymongo) |

## Repository Structure

```text
CCTVMAin/
|-- backend/
|   |-- main.py
|   |-- database.py
|   |-- requirements.txt
|   |-- routes/
|   |-- services/
|   |-- utils/
|   |-- models/
|   `-- alerts_images/
|-- frontend/
|   |-- package.json
|   |-- vite.config.js
|   `-- src/
`-- README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB running locally or cloud connection string

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd CCTVMAin

cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

### 2. Configure environment

Backend reads these environment variables:

- MONGO_URI (default: `mongodb://localhost:27017`)
- DB_NAME (default: face_recognition_db)
- PARTIAL_FACE_PERSON_CONF (default: 0.45)
- PARTIAL_FACE_CONF (default: 0.70)
- PARTIAL_FACE_STREAK (default: 3)
- PARTIAL_FACE_COOLDOWN (default: 45)
- AUTO_SCAN_INTERVAL (default: 1.0)
- AUTO_PROCESS_EVERY_N (default: 1)

Optional external alert channels (configure any one):

- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Email SMTP: `ALERT_SMTP_HOST`, `ALERT_SMTP_PORT`, `ALERT_SMTP_USER`, `ALERT_SMTP_PASS`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_TO`

Windows PowerShell example:

```powershell
$env:MONGO_URI="mongodb://localhost:27017"
$env:DB_NAME="face_recognition_db"
```

### 3. Run backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API root: <http://localhost:8000>
- Swagger docs: <http://localhost:8000/docs>

### 4. Run frontend

```bash
cd frontend
npm run dev
```

- App URL: <http://localhost:5173>

## Core Modules

- Landing: project overview and module navigation
- Register Face: employee registration and model training input
- Live CCTV Preview: camera onboarding and stream view
- CCTV Features: auto-detect control and incident monitor
- Camera Attendance: real-time attendance scanning
- Attendance: attendance records and reporting
- Alerts: unknown-person alert handling

## Main Backend Endpoints

| Group | Endpoint |
| --- | --- |
| Health | GET /health |
| Face | POST /train-face, POST /recognize-face |
| Attendance | POST /detect-attendance, GET /attendance |
| Alerts | GET /alerts, POST /alerts/handle/{id} |
| Cameras | POST /cameras, GET /cameras, GET /cameras/{id}/stream, GET /cameras/incidents/events, POST /cameras/auto-detect/start |

### Partial-Face Theft Detection Notes

- Runs inside auto-detect worker on every 3rd frame for performance.
- Detection criteria: person detected + full face missing + eyes/upper-face cues.
- Alert criteria: condition persists for N consecutive processed frames (`PARTIAL_FACE_STREAK`) and confidence > 0.7.
- Evidence: annotated frame + cropped person region saved under `backend/alerts_images/`.
- Incident type stored in DB: `theft_partial_face`.

## Example Test Run

1. Register at least one camera in Live CCTV Preview (webcam index `0` or RTSP URL).
2. Open CCTV Features and click `Start Auto-Detect`.
3. Stand in frame with a visible full face: no theft alert should trigger.
4. Conceal lower face while keeping eyes visible for 4+ processed frames.
5. Verify:
	- Live preview shows `Partial Face` boxes.
	- CCTV Incident Summary `Theft` count increases.
	- New evidence images appear in `backend/alerts_images`.
	- If Telegram/SMTP/Twilio env vars are set, external alert is delivered.

## Notes for Deployment

- Ensure MongoDB is reachable from backend runtime.
- Use a process manager for backend in production.
- Set CORS origins in backend before deploying publicly.
- Keep alert image storage path writable.

## License

MIT
