from datetime import datetime, timezone

from database import get_incidents_collection


def log_suspicious_incident(
    camera_id: str,
    camera_name: str,
    image_filename: str,
    incident_type: str = "unknown_person",
    metadata: dict | None = None,
) -> dict:
    """Persist incident with image metadata."""
    now = datetime.now(timezone.utc)
    doc = {
        "incident_type": incident_type,
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
        .find({"incident_type": {"$in": ["unknown_person", "theft_partial_face"]}}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return docs


def summarize_incidents(limit: int = 200) -> dict:
    recent = get_recent_incidents(limit=limit)
    theft_partial = [
        d for d in recent
        if d.get("incident_type") == "theft_partial_face"
    ]
    unauthorized = [
        d for d in recent
        if d.get("incident_type") == "unknown_person"
    ]
    theft_cameras = sorted({d.get("camera_name") for d in theft_partial if d.get("camera_name")})
    unauthorized_cameras = sorted({d.get("camera_name") for d in unauthorized if d.get("camera_name")})

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
            "status": "monitoring",
            "count": len(theft_partial),
            "message": "Partial-face concealment alerts near person detections.",
            "cameras": theft_cameras,
        },
        {
            "key": "unauthorized",
            "label": "Unauthorized Person",
            "status": "monitoring",
            "count": len(unauthorized),
            "message": "Face not matched with authorized records.",
            "cameras": unauthorized_cameras,
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
