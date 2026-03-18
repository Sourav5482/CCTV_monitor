from datetime import datetime, timezone

from database import get_incidents_collection


def log_suspicious_incident(
    camera_id: str,
    camera_name: str,
    image_filename: str,
    metadata: dict | None = None,
) -> dict:
    """Persist suspicious movement incident with image metadata."""
    now = datetime.now(timezone.utc)
    doc = {
        "incident_type": "suspicious_movement",
        "camera_id": camera_id,
        "camera_name": camera_name or camera_id,
        "timestamp": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "image_filename": image_filename,
        "metadata": metadata or {},
    }
    result = get_incidents_collection().insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def get_recent_incidents(limit: int = 50) -> list[dict]:
    docs = list(
        get_incidents_collection()
        .find({}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return docs


def summarize_incidents(limit: int = 200) -> dict:
    recent = get_recent_incidents(limit=limit)
    suspicious = [
        d for d in recent
        if d.get("incident_type") == "suspicious_movement"
        and d.get("metadata", {}).get("reason") in {"unknown_person", "suspicious_movement_model", "no_trained_faces"}
    ]
    cameras = sorted({d.get("camera_name") for d in suspicious if d.get("camera_name")})

    incidents = [
        {
            "key": "accident",
            "label": "Accident",
            "status": "model_required",
            "count": 0,
            "message": "Dedicated accident model not configured yet.",
            "cameras": [],
        },
        {
            "key": "theft",
            "label": "Theft",
            "status": "model_required",
            "count": 0,
            "message": "Dedicated theft model not configured yet.",
            "cameras": [],
        },
        {
            "key": "suspicious",
            "label": "Suspicious Movement",
            "status": "monitoring",
            "count": len(suspicious),
            "message": "Derived from unknown-person behavior detections.",
            "cameras": cameras,
        },
        {
            "key": "weapon",
            "label": "Gun / Weapon",
            "status": "model_required",
            "count": 0,
            "message": "Dedicated weapon model not configured yet.",
            "cameras": [],
        },
    ]

    return {
        "updated_from_incidents": len(recent),
        "incidents": incidents,
    }
