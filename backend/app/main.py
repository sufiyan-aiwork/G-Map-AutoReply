"""
Main FastAPI Application Entrypoint.
Techzone Academy - Customer Review Reply Automation System.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from contextlib import asynccontextmanager
from .config import settings
from .api import reviews, replies, dashboard, settings as settings_api, auth, admin_auth
from .services.scheduler_service import SchedulerService
from .services.admin_auth_service import AdminAuthService

# Configure basic logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("techzone_review_agent")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lifespan startup: bootstrap admin if configured & initialize background review checker
    logger.info("Initializing Techzone Academy Review Automation System...")
    await AdminAuthService.bootstrap_from_env()
    await SchedulerService.start_background_loop()
    yield
    # Lifespan shutdown: cancel background tasks cleanly
    logger.info("Shutting down background review scheduler...")
    await SchedulerService.stop_background_loop()

app = FastAPI(
    title=settings.APP_NAME,
    description="Automated Customer Review Management and Predefined Reply System for Techzone Academy",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS (explicit origins only — wildcard '*' cannot be combined with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Cache-Control",
        "Pragma",
    ],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "error": str(exc)}
    )

# Core Health Check Endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "business": settings.BUSINESS_NAME,
        "environment": settings.ENVIRONMENT,
        "classification_rule": "Deterministic (3-5 stars positive, 1-2 stars negative)"
    }

# Register API Routers
app.include_router(admin_auth.router)
app.include_router(dashboard.router)
app.include_router(reviews.router)
app.include_router(replies.router)
app.include_router(settings_api.router)
app.include_router(auth.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
