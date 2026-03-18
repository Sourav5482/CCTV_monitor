from datetime import datetime, timezone

from database import get_attendance_collection


def _today_str() -> str:
    """Return today's date as YYYY-MM-DD string."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def is_already_marked(employee_id: str, date: str | None = None) -> bool:
    """Check if attendance is already recorded for the employee today."""
    collection = get_attendance_collection()
    date = date or _today_str()
    return collection.find_one({"employee_id": employee_id, "date": date}) is not None


def mark_attendance(employee_id: str, name: str, camera_id: str = "CAM-01") -> dict:
    """Insert an attendance record for the employee.

    Returns the created record (without Mongo _id).
    """
    collection = get_attendance_collection()
    now = datetime.now(timezone.utc)
    date = now.strftime("%Y-%m-%d")
    entry_time = now.strftime("%I:%M %p")

    record = {
        "employee_id": employee_id,
        "name": name,
        "date": date,
        "entry_time": entry_time,
        "camera_id": camera_id,
        "status": "Present",
    }

    collection.insert_one(record)
    record.pop("_id", None)
    return record


def get_attendance_records(date: str | None = None, employee_id: str | None = None) -> list[dict]:
    """Fetch attendance records with optional filters."""
    collection = get_attendance_collection()
    query: dict = {}
    if date:
        query["date"] = date
    if employee_id:
        query["employee_id"] = employee_id

    cursor = collection.find(query, {"_id": 0}).sort("entry_time", -1)
    return list(cursor)
