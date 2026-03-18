import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
});

export async function trainFace(name, phone, employeeId, images) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("phone", phone);
  formData.append("employee_id", employeeId);

  for (const image of images) {
    formData.append("images", image);
  }

  const response = await API.post("/train-face", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function recognizeFace(image) {
  const formData = new FormData();
  formData.append("image", image);

  const response = await API.post("/recognize-face", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function detectAttendance(imageFile, cameraId = "CAM-01") {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("camera_id", cameraId);

  const response = await API.post("/detect-attendance", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function fetchAttendance(date, employeeId) {
  const params = {};
  if (date) params.date = date;
  if (employeeId) params.employee_id = employeeId;

  const response = await API.get("/attendance", { params });
  return response.data;
}

export async function fetchAlerts(status, limit = 50) {
  const params = { limit };
  if (status) params.status = status;

  const response = await API.get("/alerts", { params });
  return response.data;
}

export async function handleAlert(alertId, action = "dismissed") {
  const response = await API.post(`/alerts/handle/${alertId}?action=${encodeURIComponent(action)}`);
  return response.data;
}

export const ALERT_IMAGE_URL = "http://localhost:8000/alerts_images";

// ── Camera management ──────────────────────────────────────────────
export const STREAM_BASE = "http://localhost:8000/cameras";

export async function fetchCameras() {
  const response = await API.get("/cameras");
  return response.data;
}

export async function addCamera({ camera_id, name, source, location }) {
  const response = await API.post("/cameras", { camera_id, name, source, location });
  return response.data;
}

export async function deleteCamera(cameraId) {
  const response = await API.delete(`/cameras/${cameraId}`);
  return response.data;
}

export async function reconnectCamera(cameraId) {
  const response = await API.post(`/cameras/${cameraId}/reconnect`);
  return response.data;
}

export async function detectFromCamera(cameraId) {
  const response = await API.post(`/cameras/${cameraId}/detect`);
  return response.data;
}

export function getCameraStreamUrl(cameraId) {
  return `${STREAM_BASE}/${cameraId}/stream`;
}

export function getCameraSnapshotUrl(cameraId) {
  return `${STREAM_BASE}/${cameraId}/snapshot`;
}

// ── Auto-detect control ────────────────────────────────────────────
export async function startAutoDetect() {
  const response = await API.post("/cameras/auto-detect/start");
  return response.data;
}

export async function stopAutoDetect() {
  const response = await API.post("/cameras/auto-detect/stop");
  return response.data;
}

export async function getAutoDetectStatus() {
  const response = await API.get("/cameras/auto-detect/status");
  return response.data;
}

export async function getAutoDetectEvents(limit = 20) {
  const response = await API.get("/cameras/auto-detect/events", { params: { limit } });
  return response.data;
}

export async function getIncidentSummary() {
  const response = await API.get("/cameras/incidents/summary");
  return response.data;
}

export async function getIncidentEvents(limit = 20) {
  const response = await API.get("/cameras/incidents/events", { params: { limit } });
  return response.data;
}
