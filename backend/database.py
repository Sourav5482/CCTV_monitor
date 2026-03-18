import os
from pymongo import MongoClient
from pymongo.collection import Collection

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "face_recognition_db")

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_database():
    return get_client()[DB_NAME]


def get_employees_collection() -> Collection:
    return get_database()["employees"]


def get_attendance_collection() -> Collection:
    return get_database()["attendance"]


def get_alerts_collection() -> Collection:
    return get_database()["alerts"]


def get_cameras_collection() -> Collection:
    return get_database()["cameras"]


def get_incidents_collection() -> Collection:
    return get_database()["incidents"]


def close_connection():
    global _client
    if _client is not None:
        _client.close()
        _client = None
