import os
import pickle
from datetime import datetime, timezone

import numpy as np
from deepface import DeepFace
from fastapi import UploadFile

from database import get_employees_collection
from utils.image_processing import detect_face, read_image_from_upload

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
EMBEDDINGS_PATH = os.path.join(MODELS_DIR, "face_embeddings.pkl")


def _extract_embedding(face_img: np.ndarray) -> list[float]:
    """Generate a face embedding vector using DeepFace."""
    result = DeepFace.represent(
        img_path=face_img,
        model_name="Facenet",
        enforce_detection=False,
    )
    # DeepFace.represent returns a list of dicts; take the first result
    return result[0]["embedding"]


def _save_embeddings_to_file():
    """Persist all employee embeddings from the database into a pickle file."""
    collection = get_employees_collection()
    all_records = list(collection.find({}, {"_id": 0, "employee_id": 1, "name": 1, "face_embeddings": 1}))

    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(EMBEDDINGS_PATH, "wb") as f:
        pickle.dump(all_records, f)


async def train_face(name: str, employee_id: str, images: list[UploadFile], phone: str = "") -> dict:
    """Process uploaded images, extract embeddings, and store them.

    Returns a summary dict with the number of embeddings extracted.
    """
    embeddings: list[list[float]] = []

    for image_file in images:
        img = await read_image_from_upload(image_file)
        face = detect_face(img)
        if face is None:
            # Skip images where no face is detected
            continue
        embedding = _extract_embedding(face)
        embeddings.append(embedding)

    if not embeddings:
        raise ValueError("No faces could be detected in any of the uploaded images.")

    collection = get_employees_collection()

    existing = collection.find_one({"employee_id": employee_id})
    if existing:
        # Append new embeddings to existing record
        collection.update_one(
            {"employee_id": employee_id},
            {
                "$push": {"face_embeddings": {"$each": embeddings}},
                "$set": {"name": name, "phone": phone},
            },
        )
    else:
        collection.insert_one(
            {
                "employee_id": employee_id,
                "name": name,
                "phone": phone,
                "face_embeddings": embeddings,
                "created_at": datetime.now(timezone.utc),
            }
        )

    # Rebuild the local model file
    _save_embeddings_to_file()

    return {
        "employee_id": employee_id,
        "name": name,
        "embeddings_count": len(embeddings),
        "images_received": len(images),
    }
