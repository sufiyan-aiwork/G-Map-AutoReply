"""
Scheduler Service for Techzone Review Reply Automation.
Manages the background polling loop state, review sync triggers, and automation controls.
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from ..integrations.supabase_client import db

logger = logging.getLogger("scheduler_service")

class SchedulerService:
    _scheduler_task: Optional[asyncio.Task] = None
    _is_running: bool = False
    _reschedule_event: asyncio.Event = asyncio.Event()

    @classmethod
    def _get_reschedule_event(cls) -> asyncio.Event:
        """Returns a reschedule Event bound safely to the active running event loop."""
        try:
            current_loop = asyncio.get_running_loop()
            event_loop = getattr(cls._reschedule_event, "_loop", None)
            if event_loop is not None and event_loop is not current_loop:
                cls._reschedule_event = asyncio.Event()
        except RuntimeError:
            pass
        return cls._reschedule_event

    @classmethod
    async def get_status(cls) -> Dict[str, Any]:
        config = await db.get_business_config()
        return {
            "auto_reply_enabled": config.get("auto_reply_enabled", True),
            "polling_interval_minutes": config.get("polling_interval", 15),
            "business_name": config.get("business_name", "Techzone Academy"),
            "status": "active" if config.get("auto_reply_enabled", True) else "paused",
            "last_polled_at": config.get("updated_at"),
            "scheduler_running": cls._is_running
        }

    @classmethod
    async def pause_automation(cls) -> Dict[str, Any]:
        await db.update_business_config(auto_reply_enabled=False)
        await db.add_log(
            event_type="automation_paused",
            description="Administrator paused automatic reply publishing.",
            status="warning"
        )
        cls._get_reschedule_event().set()
        return {"status": "paused", "auto_reply_enabled": False}

    @classmethod
    async def resume_automation(cls) -> Dict[str, Any]:
        await db.update_business_config(auto_reply_enabled=True)
        await db.add_log(
            event_type="automation_resumed",
            description="Administrator resumed automatic reply publishing.",
            status="info"
        )
        cls._get_reschedule_event().set()
        return {"status": "active", "auto_reply_enabled": True}

    @classmethod
    async def update_settings(cls, polling_interval: int) -> Dict[str, Any]:
        if polling_interval < 1:
            raise ValueError("Polling interval must be at least 1 minute.")
        updated = await db.update_business_config(polling_interval=polling_interval)
        await db.add_log(
            event_type="settings_updated",
            description=f"Polling interval updated to {polling_interval} minutes.",
            status="info"
        )
        # Immediately interrupt the sleep countdown to reschedule with the new interval
        cls._get_reschedule_event().set()
        return updated

    @classmethod
    async def sync_now(cls) -> Dict[str, Any]:
        """Manually triggers an immediate review synchronization and reply publishing run."""
        from .review_service import ReviewService
        config = await db.get_business_config()
        is_auto_enabled = bool(config.get("auto_reply_enabled", False))
        summary = await ReviewService.sync_google_reviews(auto_publish=is_auto_enabled)
        return {
            "status": "success" if summary.get("status") != "skipped" else "skipped",
            "summary": summary
        }

    @classmethod
    async def start_background_loop(cls):
        """Starts the periodic background review checking loop."""
        if cls._is_running:
            return
        cls._is_running = True
        cls._get_reschedule_event().clear()
        cls._scheduler_task = asyncio.create_task(cls._loop())
        logger.info("Background review scheduler loop started.")

    @classmethod
    async def stop_background_loop(cls):
        """Stops the periodic background review checking loop."""
        cls._is_running = False
        cls._get_reschedule_event().set()
        if cls._scheduler_task:
            cls._scheduler_task.cancel()
            try:
                await cls._scheduler_task
            except asyncio.CancelledError:
                pass
            cls._scheduler_task = None
        cls._reschedule_event = asyncio.Event()
        logger.info("Background review scheduler loop stopped.")

    @classmethod
    async def _loop(cls):
        from .review_service import ReviewService
        while cls._is_running:
            try:
                # 1. Dynamic Automation State Check before every cycle
                config = await db.get_business_config()
                is_auto_enabled = bool(config.get("auto_reply_enabled", False))

                logger.info(
                    f"Scheduler cycle starting: auto_reply_enabled={is_auto_enabled} "
                    f"(auto_publish={is_auto_enabled})."
                )

                # When auto_reply_enabled is True: pass auto_publish=True
                # When auto_reply_enabled is False: pass auto_publish=False (reviews are synchronized and stored, no automatic replies published)
                await ReviewService.sync_google_reviews(auto_publish=is_auto_enabled)

                interval_minutes = config.get("polling_interval", 15)
                # Interruptible sleep: wait for interval timeout OR reschedule event
                event = cls._get_reschedule_event()
                event.clear()
                try:
                    await asyncio.wait_for(event.wait(), timeout=interval_minutes * 60)
                    logger.info("Scheduler sleep interrupted due to configuration change. Starting fresh cycle.")
                except asyncio.TimeoutError:
                    # Normal interval elapsed
                    pass
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler background loop: {e}")
                await asyncio.sleep(30)
