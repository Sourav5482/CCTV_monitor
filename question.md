# Hackathon Q&A for CCTV Monitoring Project

## 1. What problem are you solving?
**Answer:**
This project solves real-time security monitoring and automated attendance from CCTV feeds. It reduces manual watch effort by detecting unknown people, tracking partial-face concealment incidents, and marking attendance automatically for recognized employees.

## 2. What is your tech stack and why did you choose it?
**Answer:**
Frontend is React + Vite, backend is FastAPI, and database is MongoDB. OpenCV handles camera streaming and image preprocessing, while DeepFace (Facenet embeddings) is used for recognition. This stack gives fast API iteration, easy UI updates, and flexible schema for incident logs.

## 3. How does face recognition work in your system?
**Answer:**
During registration, multiple images are captured and converted into face embeddings. At runtime, a detected face is embedded and compared with stored embeddings using cosine similarity. The best match above threshold is accepted; otherwise the person is treated as unknown.

## 4. Why did you set the recognition threshold around 0.68?
**Answer:**
A threshold near 0.68 balances false positives and false negatives for this dataset and camera quality. Lower thresholds increase wrong matches, while higher thresholds reject valid users more often. It is configurable and should be tuned per deployment.

## 5. How do you prevent duplicate attendance entries?
**Answer:**
Before writing attendance, the backend checks if that employee is already marked for the same date. There is also a compound index on employee_id + date to support fast lookup and consistency.

## 6. What happens when an unknown person appears repeatedly?
**Answer:**
Unknown detections create alerts with saved evidence images. The system deduplicates alerts by embedding similarity (with a recent time window), so repeated sightings of the same unknown person update detection_count instead of creating noisy duplicate alerts.

## 7. How do you support multiple camera sources?
**Answer:**
Each camera runs in its own background stream thread, and latest frames are cached for streaming and detection. Sources can be webcam index, RTSP URL, or HTTP stream. A retry loop attempts reconnection for offline streams.

## 8. How is real-time performance managed?
**Answer:**
The auto-detect worker scans frames at a configurable interval and supports skip-frame processing (process every N frames). Camera streams target around 15 FPS for stable load. Cooldowns suppress repeated events for the same person/camera.

## 9. How does theft or concealment detection work?
**Answer:**
Theft monitoring uses YOLO person detection first (with OpenCV HOG fallback). For each person ROI, it checks face visibility cues: if eyes are visible but lower-face cues are missing for consecutive frames, it triggers a partial-face incident and saves evidence.

## 10. Why combine YOLO with classic OpenCV fallbacks?
**Answer:**
YOLO gives better detection quality, while OpenCV HOG fallback improves resilience when model loading or GPU acceleration is unavailable. This hybrid approach keeps the system functional in lower-resource environments.

## 11. How are alerts communicated to users?
**Answer:**
The UI shows live events and alert tables, and operators can dismiss or escalate incidents. For external notification, an async worker can send alerts to Telegram, SMTP email, or Twilio based on environment configuration.

## 12. How do you avoid blocking detection while sending notifications?
**Answer:**
Notifications are queued and processed in a separate worker thread. Detection path only enqueues payloads, so real-time frame analysis is not delayed by network/API latency of external channels.

## 13. How do you store and expose evidence images?
**Answer:**
Alert/incident images are written to backend/alerts_images and served through a static route. Each alert stores the primary image and optional image history, enabling quick operator review and timeline context.

## 14. What are your current security and privacy considerations?
**Answer:**
Employee biometric embeddings and alert data are stored in MongoDB and should be protected with access controls, encrypted connections, and strict retention policy. CORS is currently open for development and must be restricted in production.

## 15. How would you scale this for a larger deployment?
**Answer:**
We would separate stream ingestion, detection workers, and API into independent services, then scale workers horizontally by camera partitions. Additional improvements include message queues (Kafka/RabbitMQ), object storage for images, and model-serving endpoints.

## 16. What is your failure-handling strategy?
**Answer:**
Camera disconnections are handled with reconnect and periodic retry logic. If models or face detection fail on a frame, that frame is skipped safely. Auto-detect and notification workers can be started/stopped cleanly with app lifecycle hooks.

## 17. What are known limitations right now?
**Answer:**
Accident and weapon modules are placeholders in incident summary and need dedicated models. Recognition quality depends on registration image diversity and camera angle/lighting. Also, current backend is a single-process design, so very high camera count needs architecture split.

## 18. How would you improve recognition accuracy next?
**Answer:**
Collect more varied enrollment images (angles, lighting, expressions), apply quality checks before training, and tune thresholds per location/camera profile. We can also add liveness checks and periodic re-enrollment for model drift reduction.

## 19. How would you test this system in a hackathon demo?
**Answer:**
Demo flow: register users, add webcam/mobile stream, start auto-detect, show successful attendance for known faces, then trigger unknown and partial-face scenarios to produce incidents and alerts. Finally, verify records in Attendance and Alerts pages with evidence images.

## 20. What makes this project hackathon-worthy?
**Answer:**
It is an end-to-end working product, not only a model demo: camera onboarding, live inference, attendance automation, incident logging, actionable alerts, and monitoring dashboard are integrated. The design is practical for real security and workplace operations with clear extension points.