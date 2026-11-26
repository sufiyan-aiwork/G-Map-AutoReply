"""
Main FastAPI Application Entrypoint.
Techzone Academy - Customer Review Reply Automation System.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import uuid
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
    # Fail closed if production runtime security requirements (e.g. ADMIN_AUTH_SECRET) are unmet
    AdminAuthService.validate_runtime_security()
    logger.info("Initializing Techzone Academy Review Automation System...")
    await AdminAuthService.bootstrap_from_env()
    await SchedulerService.start_background_loop()
    yield
    # Lifespan shutdown: cancel background tasks cleanly
    logger.info("Shutting down background review scheduler...")
    await SchedulerService.stop_background_loop()


_is_prod = settings.ENVIRONMENT.lower() == "production"

app = FastAPI(
    title=settings.APP_NAME,
    description="Automated Customer Review Management and Predefined Reply System for Techzone Academy",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)


@app.middleware("http")
async def security_hardening_middleware(request: Request, call_next):
    # Enforce request payload size limit (Content-Length check + streaming check for chunked bodies)
    max_bytes = max(1024, int(settings.MAX_REQUEST_BODY_BYTES or 1_048_576))
    content_len = request.headers.get("content-length")
    if content_len:
        try:
            if int(content_len) > max_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content={"detail": "Request payload exceeds maximum allowed size."},
                )
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid Content-Length header."},
            )
    elif request.method.upper() in ("POST", "PUT", "PATCH"):
        body = await request.body()
        if len(body) > max_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                content={"detail": "Request payload exceeds maximum allowed size."},
            )

    response = await call_next(request)

    # Apply defensive HTTP security headers
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    if settings.ENVIRONMENT.lower() == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

    return response


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
        "X-CSRF-Token",
        "Cache-Control",
        "Pragma",
    ],
)

# Global Exception Handler (never leaks internal stack/exception details to clients)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = uuid.uuid4().hex[:12]
    logger.error(f"Unhandled exception [{error_id}] at {request.url.path}: {type(exc).__name__}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "error_id": error_id}
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
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT.lower() == "development"),
    )
