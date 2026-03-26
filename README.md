# CCTV Face Recognition and Monitoring System

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

## Notes for Deployment

- Ensure MongoDB is reachable from backend runtime.
- Use a process manager for backend in production.
- Set CORS origins in backend before deploying publicly.
- Keep alert image storage path writable.

## License

MIT
