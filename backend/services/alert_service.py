import os
import uuid
from datetime import datetime, timezone, timedelta

import cv2
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from database import get_alerts_collection

ALERTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alerts_images")

# If an unknown face matches an existing unhandled alert with this similarity,
# treat it as the same person and append the image instead of creating a new alert.
ALERT_DEDUP_THRESHOLD = 0.55

# Only look at alerts from the last N minutes for deduplication
ALERT_DEDUP_WINDOW_MINUTES = 30


def save_alert_image(image: np.ndarray) -> str:
    """Save an unknown-person frame to disk and return the filename."""
    os.makedirs(ALERTS_DIR, exist_ok=True)
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(ALERTS_DIR, filename)
    cv2.imwrite(filepath, image)
    return filename


def _find_matching_alert(embedding: list[float]) -> dict | None:
    """Check recent unhandled alerts for a face that matches the given embedding."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=ALERT_DEDUP_WINDOW_MINUTES)).isoformat()
    recent = list(
        get_alerts_collection().find({
            "status": "unhandled",
            "timestamp": {"$gte": cutoff},
            "embedding": {"$exists": True},
        }).sort("timestamp", -1).limit(50)
    )
    if not recent:
        return None

    query = np.array(embedding).reshape(1, -1)
    for alert in recent:
        stored = np.array(alert["embedding"]).reshape(1, -1)
        sim = float(cosine_similarity(query, stored).flatten()[0])
        if sim >= ALERT_DEDUP_THRESHOLD:
            return alert
    return None


def create_or_update_alert(camera_id: str, image_filename: str, embedding: list[float]) -> dict:
    """Create a new alert or append the image to an existing matching alert."""
    existing = _find_matching_alert(embedding)

    if existing:
        # Same person detected again — append image, bump timestamp
        get_alerts_collection().update_one(
            {"_id": existing["_id"]},
            {
                "$push": {"images": image_filename},
                "$set": {"last_seen": datetime.now(timezone.utc).isoformat()},
                "$inc": {"detection_count": 1},
            },
        )
        return {"_id": str(existing["_id"])}

    # New unknown person
    doc = {
        "alert_type": "unknown_person",
        "camera_id": camera_id,
        "image_filename": image_filename,   # first/primary image
        "images": [image_filename],          # all captured images
        "embedding": embedding,              # face embedding for dedup
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "detection_count": 1,
        "status": "unhandled",
    }
    result = get_alerts_collection().insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def get_alerts(status: str | None = None, limit: int = 50) -> list[dict]:
    """Return recent alerts, optionally filtered by status."""
    query = {}
    if status:
        query["status"] = status
    cursor = get_alerts_collection().find(
        query, {"embedding": 0}  # exclude large embedding array from response
    ).sort("timestamp", -1).limit(limit)
    alerts = []
    for a in cursor:
        a["_id"] = str(a["_id"])
        alerts.append(a)
    return alerts


def handle_alert(alert_id: str, action: str = "dismissed") -> bool:
    """Mark an alert as handled. Returns True if the alert was found and updated."""
    from bson import ObjectId

    result = get_alerts_collection().update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {"status": action, "handled_at": datetime.now(timezone.utc).isoformat()}},
    )
    return result.modified_count == 1
