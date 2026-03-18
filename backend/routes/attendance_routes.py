import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from sklearn.metrics.pairwise import cosine_similarity

from services.attendance_service import get_attendance_records, is_already_marked, mark_attendance
from services.alert_service import create_or_update_alert, save_alert_image
from services.face_recognition import _extract_embedding, _load_embeddings
from utils.image_processing import detect_face, read_image_from_upload

router = APIRouter()

ATTENDANCE_THRESHOLD = 0.68


@router.post("/detect-attendance")
async def detect_attendance(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM-01"),
):
    """Detect a face in the frame and mark attendance if recognized."""
    img = await read_image_from_upload(image)
    face = detect_face(img)
    if face is None:
        return {"status": "Unknown Person", "message": "No face detected in the frame."}

    query_embedding = np.array(_extract_embedding(face)).reshape(1, -1)

    records = _load_embeddings()
    if not records:
        return {"status": "Unknown Person", "message": "No trained faces available."}

    best_match = None
    best_score = -1.0

    for record in records:
        stored = np.array(record["face_embeddings"])
        similarities = cosine_similarity(query_embedding, stored).flatten()
        max_similarity = float(np.max(similarities))

        if max_similarity > best_score:
            best_score = max_similarity
            best_match = record

    if best_match is None or best_score < ATTENDANCE_THRESHOLD:
        # Save the frame and create/update an alert for the unknown person
        filename = save_alert_image(img)
        embedding_list = query_embedding.flatten().tolist()
        alert = create_or_update_alert(
            camera_id=camera_id,
            image_filename=filename,
            embedding=embedding_list,
        )
        return {
            "status": "Unknown Person",
            "alert_id": alert["_id"],
            "image_filename": filename,
        }

    employee_id = best_match["employee_id"]
    name = best_match["name"]

    # Duplicate check — don't mark twice in the same day
    if is_already_marked(employee_id):
        return {
            "employee_id": employee_id,
            "name": name,
            "status": "Already Marked",
            "confidence": round(best_score, 4),
        }

    mark_attendance(employee_id=employee_id, name=name, camera_id=camera_id)

    return {
        "employee_id": employee_id,
        "name": name,
        "status": "Attendance Marked",
        "confidence": round(best_score, 4),
    }


@router.get("/attendance")
async def fetch_attendance(
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    employee_id: str | None = Query(None, description="Filter by employee ID"),
):
    """Return attendance records with optional date and employee_id filters."""
    records = get_attendance_records(date=date, employee_id=employee_id)
    return {"count": len(records), "records": records}
