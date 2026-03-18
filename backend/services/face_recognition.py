import os
import pickle

import numpy as np
from deepface import DeepFace
from fastapi import UploadFile
from sklearn.metrics.pairwise import cosine_similarity

from utils.image_processing import detect_face, read_image_from_upload

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
EMBEDDINGS_PATH = os.path.join(MODELS_DIR, "face_embeddings.pkl")

SIMILARITY_THRESHOLD = 0.68


def _load_embeddings() -> list[dict]:
    """Load all stored embeddings from the pickle model file."""
    if not os.path.exists(EMBEDDINGS_PATH):
        return []
    with open(EMBEDDINGS_PATH, "rb") as f:
        return pickle.load(f)


def _extract_embedding(face_img: np.ndarray) -> list[float]:
    """Generate a face embedding vector using DeepFace."""
    result = DeepFace.represent(
        img_path=face_img,
        model_name="Facenet",
        enforce_detection=False,
    )
    return result[0]["embedding"]


async def recognize_face(image: UploadFile) -> dict:
    """Identify a person from a single uploaded image.

    Returns matched employee info with confidence, or status 'unknown'.
    """
    img = await read_image_from_upload(image)
    face = detect_face(img)
    if face is None:
        return {"status": "unknown", "message": "No face detected in the image."}

    query_embedding = np.array(_extract_embedding(face)).reshape(1, -1)

    records = _load_embeddings()
    if not records:
        return {"status": "unknown", "message": "No trained faces available."}

    best_match = None
    best_score = -1.0

    for record in records:
        stored = np.array(record["face_embeddings"])
        # Compare query against every stored embedding for this employee
        similarities = cosine_similarity(query_embedding, stored).flatten()
        max_similarity = float(np.max(similarities))

        if max_similarity > best_score:
            best_score = max_similarity
            best_match = record

    if best_match is not None and best_score >= SIMILARITY_THRESHOLD:
        return {
            "employee_id": best_match["employee_id"],
            "name": best_match["name"],
            "confidence": round(best_score, 4),
        }

    return {"status": "unknown"}
