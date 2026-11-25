"""
Automation Settings and System Logs API.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from ..services.scheduler_service import SchedulerService
from ..integrations.supabase_client import db
from .admin_auth import require_admin

router = APIRouter(
    prefix="/api",
    tags=["Settings & Logs"],
    dependencies=[Depends(require_admin)],
)

class UpdateSettingsRequest(BaseModel):
    polling_interval: Optional[int] = Field(None, ge=1, le=1440, description="Interval in minutes (1 to 1440)")
    auto_reply_enabled: Optional[bool] = None

@router.get("/database/status")
async def get_database_status() -> Dict[str, Any]:
    """Returns live Supabase connectivity and table readiness report."""
    return await db.check_connection_status()

@router.get("/automation/status")
async def get_automation_status() -> Dict[str, Any]:
    return await SchedulerService.get_status()

@router.post("/automation/pause")
async def pause_automation() -> Dict[str, Any]:
    return await SchedulerService.pause_automation()

@router.post("/automation/resume")
async def resume_automation() -> Dict[str, Any]:
    return await SchedulerService.resume_automation()

@router.put("/automation/settings")
async def update_settings(req: UpdateSettingsRequest) -> Dict[str, Any]:
    if req.polling_interval is not None:
        await SchedulerService.update_settings(req.polling_interval)
    if req.auto_reply_enabled is not None:
        if req.auto_reply_enabled:
            await SchedulerService.resume_automation()
        else:
            await SchedulerService.pause_automation()
    return await SchedulerService.get_status()

@router.get("/logs")
async def list_logs(limit: int = Query(50, ge=1, le=200)) -> List[Dict[str, Any]]:
    return await db.get_logs(limit=limit)
