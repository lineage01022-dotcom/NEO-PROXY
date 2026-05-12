"""Pydantic models and helper schemas."""
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ------ Auth ------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: Optional[str] = None
    role: str = "user"
    created_at: Optional[datetime] = None


# ------ Proxy ------
PROTOCOLS = ("http", "https", "socks4", "socks5")
STATUSES = ("active", "dead", "checking", "unknown")


class ProxyIn(BaseModel):
    host: str
    port: int = Field(ge=1, le=65535)
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str = "http"
    tags: List[str] = []
    country: Optional[str] = None
    notes: Optional[str] = None


class ProxyUpdate(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: Optional[str] = None
    tags: Optional[List[str]] = None
    country: Optional[str] = None
    notes: Optional[str] = None


class ProxyOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: str
    tags: List[str] = []
    country: Optional[str] = None
    notes: Optional[str] = None
    status: str = "unknown"
    latency_ms: Optional[int] = None
    last_checked_at: Optional[datetime] = None
    last_error: Optional[str] = None
    fail_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BulkImportIn(BaseModel):
    text: str
    default_protocol: str = "http"
    default_tags: List[str] = []
    default_country: Optional[str] = None


class BulkImportOut(BaseModel):
    inserted: int
    skipped: int
    errors: List[str] = []


# ------ API Keys ------
class ApiKeyCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    key_preview: str
    created_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    revoked: bool = False


class ApiKeyCreatedOut(ApiKeyOut):
    key: str  # full key returned ONLY on creation
