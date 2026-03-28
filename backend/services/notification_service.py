"""Asynchronous alert notifications for external contacts.

Supported channels (auto-selected by env vars):
1) Telegram Bot API
2) SMTP email
3) Twilio WhatsApp/SMS REST API
"""

from __future__ import annotations

import logging
import os
import queue
import smtplib
import threading
from email.message import EmailMessage

import requests

logger = logging.getLogger("notification_service")

_queue: "queue.Queue[dict]" = queue.Queue(maxsize=200)
_running = False
_worker: threading.Thread | None = None


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _build_message(alert: dict) -> str:
    return (
        "CCTV ALERT: Partial face concealment detected\n"
        f"Camera: {alert.get('camera_name') or alert.get('camera_id')}\n"
        f"Confidence: {alert.get('confidence')}\n"
        f"Reason: {alert.get('reason')}\n"
        f"Time: {alert.get('timestamp')}"
    )


def _send_telegram(alert: dict) -> bool:
    token = _env("TELEGRAM_BOT_TOKEN")
    chat_id = _env("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False

    text = _build_message(alert)
    image_filename = alert.get("image_filename", "")
    image_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alerts_images", image_filename)

    try:
        if image_filename and os.path.exists(image_path):
            with open(image_path, "rb") as f:
                response = requests.post(
                    f"https://api.telegram.org/bot{token}/sendPhoto",
                    data={"chat_id": chat_id, "caption": text},
                    files={"photo": f},
                    timeout=15,
                )
        else:
            response = requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                data={"chat_id": chat_id, "text": text},
                timeout=15,
            )
        return response.ok
    except Exception as exc:
        logger.warning("Telegram alert failed: %s", exc)
        return False


def _send_email(alert: dict) -> bool:
    host = _env("ALERT_SMTP_HOST")
    port = int(_env("ALERT_SMTP_PORT", "587") or "587")
    user = _env("ALERT_SMTP_USER")
    password = _env("ALERT_SMTP_PASS")
    to_addr = _env("ALERT_EMAIL_TO")
    from_addr = _env("ALERT_EMAIL_FROM", user)

    if not host or not user or not password or not to_addr:
        return False

    msg = EmailMessage()
    msg["Subject"] = "CCTV Partial Face Alert"
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(_build_message(alert))

    image_filename = alert.get("image_filename", "")
    image_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alerts_images", image_filename)
    if image_filename and os.path.exists(image_path):
        with open(image_path, "rb") as f:
            data = f.read()
        msg.add_attachment(data, maintype="image", subtype="jpeg", filename=image_filename)

    try:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("Email alert failed: %s", exc)
        return False


def _send_twilio(alert: dict) -> bool:
    sid = _env("TWILIO_ACCOUNT_SID")
    token = _env("TWILIO_AUTH_TOKEN")
    from_no = _env("TWILIO_FROM")
    to_no = _env("TWILIO_TO")
    if not sid or not token or not from_no or not to_no:
        return False

    body = _build_message(alert)
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    try:
        response = requests.post(
            endpoint,
            data={"From": from_no, "To": to_no, "Body": body},
            auth=(sid, token),
            timeout=15,
        )
        return response.ok
    except Exception as exc:
        logger.warning("Twilio alert failed: %s", exc)
        return False


def _notify_once(alert: dict):
    # Priority order keeps config simple: Telegram -> Email -> Twilio
    sent = _send_telegram(alert) or _send_email(alert) or _send_twilio(alert)
    if sent:
        logger.info("External alert sent for camera=%s", alert.get("camera_id"))
    else:
        logger.info("No external alert channel configured; incident logged only")


def _worker_loop():
    global _running
    while _running:
        try:
            alert = _queue.get(timeout=1)
        except queue.Empty:
            continue
        try:
            _notify_once(alert)
        finally:
            _queue.task_done()


def start_notification_worker():
    global _running, _worker
    if _running:
        return
    _running = True
    _worker = threading.Thread(target=_worker_loop, daemon=True, name="notification-worker")
    _worker.start()


def stop_notification_worker():
    global _running, _worker
    _running = False
    if _worker:
        _worker.join(timeout=3)
        _worker = None


def enqueue_partial_face_alert(alert_payload: dict):
    """Queue alert notification without blocking real-time detection."""
    if not _running:
        start_notification_worker()
    try:
        _queue.put_nowait(alert_payload)
    except queue.Full:
        logger.warning("Notification queue full; dropping alert for camera=%s", alert_payload.get("camera_id"))
