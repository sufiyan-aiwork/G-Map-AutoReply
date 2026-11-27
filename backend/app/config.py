from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ENV_PATH, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "Techzone Review Reply Automation"
    BUSINESS_NAME: str = "Techzone Academy"
    ENVIRONMENT: str = "development"
    TIMEZONE: str = "Asia/Kolkata"
    
    # API & Server Config
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    FRONTEND_URL: str = "http://localhost:5174"
    MAX_REQUEST_BODY_BYTES: int = 1_048_576  # 1 MB request payload limit
    TRUSTED_PROXY_IPS: List[str] = []
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:3000",
        "http://[::1]:5173",
        "http://[::1]:5174",
    ]
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    # Google Business Profile Config (for Phase 2)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = "http://localhost:8000/api/auth/google/callback"
    GOOGLE_ACCOUNT_ID: Optional[str] = None
    GOOGLE_LOCATION_ID: Optional[str] = None
    GOOGLE_TOKEN_ENCRYPTION_KEY: Optional[str] = None
    
    # Automation Defaults
    DEFAULT_POLLING_INTERVAL: int = 15  # in minutes
    AUTO_REPLY_ENABLED: bool = True

    # Admin Authentication & Session Security
    ADMIN_AUTH_SECRET: Optional[str] = None
    ADMIN_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    ADMIN_COOKIE_NAME: str = "tz_admin_session"
    ADMIN_LOGIN_MAX_ATTEMPTS: int = 5
    ADMIN_LOGIN_WINDOW_SECONDS: int = 900  # 15 minutes
    ADMIN_BOOTSTRAP_USERNAME: Optional[str] = None
    ADMIN_BOOTSTRAP_PASSWORD: Optional[str] = None
    ADMIN_BOOTSTRAP_PASSWORD_HASH: Optional[str] = None
    ADMIN_BOOTSTRAP_FULL_NAME: str = "Techzone Administrator"

settings = Settings()
