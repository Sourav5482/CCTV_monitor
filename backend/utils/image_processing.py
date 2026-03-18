import cv2
import numpy as np
from fastapi import UploadFile


async def read_image_from_upload(file: UploadFile) -> np.ndarray:
    """Read an uploaded file and convert it to an OpenCV BGR image."""
    contents = await file.read()
    np_arr = np.frombuffer(contents, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not decode image from file: {file.filename}")
    return img


def detect_face(image: np.ndarray) -> np.ndarray | None:
    """Detect a face in the image using OpenCV's Haar cascade.

    Returns the cropped face region or None if no face is found.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        return None

    # Use the largest detected face
    x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
    return image[y : y + h, x : x + w]
