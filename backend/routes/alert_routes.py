from fastapi import APIRouter, HTTPException, Query

from services.alert_service import get_alerts, handle_alert

router = APIRouter()


@router.get("/alerts")
async def list_alerts(
    status: str | None = Query(None, description="Filter by status (unhandled, dismissed, escalated)"),
    limit: int = Query(50, ge=1, le=200),
):
    """Return recent alert records."""
    alerts = get_alerts(status=status, limit=limit)
    return {"count": len(alerts), "alerts": alerts}


@router.post("/alerts/handle/{alert_id}")
async def mark_alert_handled(alert_id: str, action: str = Query("dismissed")):
    """Mark an alert as dismissed or escalated."""
    if action not in ("dismissed", "escalated"):
        raise HTTPException(status_code=400, detail="action must be 'dismissed' or 'escalated'")
    success = handle_alert(alert_id, action=action)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "ok", "alert_id": alert_id, "action": action}
