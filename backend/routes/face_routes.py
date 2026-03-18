from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.face_recognition import recognize_face
from services.face_training import train_face

router = APIRouter()


@router.post("/train-face")
async def train_face_endpoint(
    name: str = Form(...),
    employee_id: str = Form(...),
    phone: str = Form(""),
    images: list[UploadFile] = File(...),
):
    """Register a person and train face embeddings from uploaded images."""
    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required.")

    try:
        result = await train_face(name=name, employee_id=employee_id, phone=phone, images=images)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "success",
        "message": f"Face training complete for {name}.",
        "data": result,
    }


@router.post("/recognize-face")
async def recognize_face_endpoint(
    image: UploadFile = File(...),
):
    """Recognize a face from a single uploaded image."""
    try:
        result = await recognize_face(image=image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result
