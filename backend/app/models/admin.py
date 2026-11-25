"""
Pydantic Models for Administrator Authentication and Sessions.
"""

from pydantic import BaseModel, Field
from typing import Optional

class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100, description="Administrator username")
    password: str = Field(..., min_length=1, max_length=256, description="Administrator password")

class AdminUserInfo(BaseModel):
    id: str
    username: str
    full_name: str
    is_active: bool
    last_login_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class AdminSessionResponse(BaseModel):
    authenticated: bool
    admin: AdminUserInfo
    expires_in: Optional[int] = None

class AdminLogoutResponse(BaseModel):
    authenticated: bool
    message: str
