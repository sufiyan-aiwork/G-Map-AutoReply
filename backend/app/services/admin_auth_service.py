"""
Administrator Authentication, Password Hashing, Rate Limiting, and Session Service.
Implements:
- Salted scrypt password hashing (hashlib.scrypt) & constant-time verification (hmac.compare_digest)
- HMAC-SHA256 signed 8-hour session tokens (HS256)
- Sliding-window brute-force rate limiting
- Audit logging to Supabase system_logs (never logging passwords, hashes, or tokens)
- OAuth CSRF state token generation & validation for Google OAuth callback protection
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from ..config import settings
from ..integrations.supabase_client import db

logger = logging.getLogger("admin_auth_service")

# Scrypt security parameters (memory-hard KDF safe within OpenSSL 32MB limit)
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SCRYPT_MAXMEM = 32 * 1024 * 1024

# Dummy precomputed scrypt salt to mitigate username-enumeration timing differences
_DUMMY_SALT = b"techzone_dummy_s"


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


class AdminAuthService:
    _ephemeral_secret: Optional[str] = None
    _revoked_jtis: Dict[str, float] = {}
    _failed_attempts: Dict[str, List[float]] = defaultdict(list)
    _pending_oauth_states: Dict[str, float] = {}
    _MAX_RATE_LIMIT_KEYS: int = 5000

    @classmethod
    def validate_runtime_security(cls) -> None:
        """Fail fast at startup if running in production without a strong signing secret."""
        if settings.ENVIRONMENT.lower() == "production":
            configured = (settings.ADMIN_AUTH_SECRET or "").strip()
            if not configured or configured.startswith("replace-with-") or len(configured) < 32:
                raise RuntimeError(
                    "CRITICAL SECURITY CONFIG ERROR: ADMIN_AUTH_SECRET must be set to at least 32 random characters in production."
                )

    @classmethod
    def _get_signing_secret(cls) -> bytes:
        configured = (settings.ADMIN_AUTH_SECRET or "").strip()
        if configured and not configured.startswith("replace-with-") and len(configured) >= 32:
            return configured.encode("utf-8")
        if settings.ENVIRONMENT.lower() == "production":
            raise RuntimeError(
                "ADMIN_AUTH_SECRET is missing, placeholder, or shorter than 32 characters in production."
            )
        if configured and not configured.startswith("replace-with-"):
            logger.warning("ADMIN_AUTH_SECRET is shorter than 32 characters; upgrade recommended.")
            return configured.encode("utf-8")
        if cls._ephemeral_secret is None:
            cls._ephemeral_secret = secrets.token_urlsafe(48)
            logger.warning("ADMIN_AUTH_SECRET is not configured in development; generated ephemeral process key.")
        return cls._ephemeral_secret.encode("utf-8")

    # ====================================================================
    # Password Hashing & Constant-Time Verification
    # ====================================================================
    @staticmethod
    def hash_password(password: str) -> str:
        """Hashes a plaintext password with a random 16-byte salt using hashlib.scrypt."""
        if not password:
            raise ValueError("Password cannot be empty.")
        salt = secrets.token_bytes(16)
        derived = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=SCRYPT_N,
            r=SCRYPT_R,
            p=SCRYPT_P,
            maxmem=SCRYPT_MAXMEM,
            dklen=SCRYPT_DKLEN,
        )
        return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64url_encode(salt)}${_b64url_encode(derived)}"

    @staticmethod
    def verify_password(password: str, stored_hash: str) -> bool:
        """Verifies a plaintext password against a stored scrypt hash using hmac.compare_digest."""
        if not password or not stored_hash:
            return False
        try:
            parts = stored_hash.split("$")
            if len(parts) != 6 or parts[0] != "scrypt":
                return False
            n = int(parts[1])
            r = int(parts[2])
            p = int(parts[3])
            salt = _b64url_decode(parts[4])
            expected_dk = _b64url_decode(parts[5])
            if n <= 1 or r <= 0 or p <= 0 or len(salt) < 8 or len(expected_dk) < 16:
                return False

            derived = hashlib.scrypt(
                password.encode("utf-8"),
                salt=salt,
                n=n,
                r=r,
                p=p,
                maxmem=SCRYPT_MAXMEM,
                dklen=len(expected_dk),
            )
            return hmac.compare_digest(derived, expected_dk)
        except Exception:
            return False

    @staticmethod
    def sanitize_admin(admin: Dict[str, Any]) -> Dict[str, Any]:
        """Strips password_hash and sensitive internals before returning admin profile."""
        return {
            "id": str(admin.get("id", "")),
            "username": admin.get("username", ""),
            "full_name": admin.get("full_name", "Administrator"),
            "is_active": bool(admin.get("is_active", False)),
            "last_login_at": admin.get("last_login_at"),
            "created_at": admin.get("created_at"),
            "updated_at": admin.get("updated_at"),
        }

    # ====================================================================
    # HMAC-SHA256 Signed Sessions (8-Hour Expiry + Revocation + CSRF)
    # ====================================================================
    @classmethod
    def create_session_token(
        cls,
        admin_user: Dict[str, Any],
        expires_minutes: Optional[int] = None,
    ) -> Tuple[str, int]:
        """Creates an HMAC-SHA256 signed JWT session token with 8-hour default expiry."""
        ttl_seconds = (expires_minutes if expires_minutes is not None else settings.ADMIN_TOKEN_EXPIRE_MINUTES) * 60
        now_ts = int(time.time())
        exp_ts = now_ts + ttl_seconds

        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": str(admin_user["id"]),
            "username": admin_user["username"],
            "iat": now_ts,
            "exp": exp_ts,
            "jti": secrets.token_hex(16),
        }

        header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        sig = hmac.new(cls._get_signing_secret(), signing_input, hashlib.sha256).digest()
        token = f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"
        return token, ttl_seconds

    @classmethod
    def derive_csrf_token(cls, token_or_payload: Any) -> Optional[str]:
        """Derives a deterministic session-bound CSRF token using HMAC-SHA256."""
        if isinstance(token_or_payload, str):
            payload = cls.decode_and_verify_token(token_or_payload)
        elif isinstance(token_or_payload, dict):
            payload = token_or_payload
        else:
            payload = None
        if not payload or not payload.get("jti") or not payload.get("sub"):
            return None
        msg = f"csrf:{payload['jti']}:{payload['sub']}".encode("utf-8")
        digest = hmac.new(cls._get_signing_secret(), msg, hashlib.sha256).digest()
        return _b64url_encode(digest)

    @classmethod
    def verify_csrf_token(cls, token_or_payload: Any, provided_csrf: Optional[str]) -> bool:
        if not provided_csrf:
            return False
        expected = cls.derive_csrf_token(token_or_payload)
        if not expected:
            return False
        return hmac.compare_digest(expected, provided_csrf.strip())

    @classmethod
    def _prune_revoked_jtis(cls, now_ts: float) -> None:
        expired = [jti for jti, exp in cls._revoked_jtis.items() if exp <= now_ts]
        for jti in expired:
            cls._revoked_jtis.pop(jti, None)

    @classmethod
    def decode_and_verify_token(cls, token: str) -> Optional[Dict[str, Any]]:
        """Verifies HMAC-SHA256 signature, expiration, and local revocation status."""
        if not token or token.count(".") != 2:
            return None
        try:
            header_b64, payload_b64, sig_b64 = token.split(".")
            signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
            expected_sig = hmac.new(cls._get_signing_secret(), signing_input, hashlib.sha256).digest()
            provided_sig = _b64url_decode(sig_b64)

            if not hmac.compare_digest(expected_sig, provided_sig):
                return None

            header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
            if header.get("alg") != "HS256":
                return None

            payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
            now_ts = time.time()
            exp = payload.get("exp")
            if not isinstance(exp, (int, float)) or exp <= now_ts:
                return None

            cls._prune_revoked_jtis(now_ts)
            jti = payload.get("jti")
            if not jti or jti in cls._revoked_jtis:
                return None

            if not payload.get("sub") or not payload.get("username"):
                return None
            return payload
        except Exception:
            return None

    @classmethod
    def revoke_session_token(cls, token: Optional[str]) -> None:
        """Revokes an active session token immediately in process memory."""
        if not token:
            return
        payload = cls.decode_and_verify_token(token)
        if payload and payload.get("jti") and payload.get("exp"):
            cls._revoked_jtis[payload["jti"]] = float(payload["exp"])

    @classmethod
    async def revoke_session_token_persistent(cls, token: Optional[str]) -> None:
        """Revokes an active session token in both process memory and persistent storage."""
        if not token:
            return
        payload = cls.decode_and_verify_token(token)
        if payload and payload.get("jti") and payload.get("exp"):
            jti = payload["jti"]
            exp_ts = float(payload["exp"])
            cls._revoked_jtis[jti] = exp_ts
            await db.revoke_token_jti(jti=jti, exp_ts=exp_ts)

    # ====================================================================
    # Login Brute-Force Rate Limiting (Per-IP, Per-Username & Bounded Memory)
    # ====================================================================
    @classmethod
    def reset_rate_limits(cls) -> None:
        """Clears in-memory rate limit tracking (used in isolated tests)."""
        cls._failed_attempts.clear()

    @classmethod
    def _prune_attempts(cls, key: str, now_ts: float) -> List[float]:
        window = settings.ADMIN_LOGIN_WINDOW_SECONDS
        recent = [ts for ts in cls._failed_attempts.get(key, []) if (now_ts - ts) < window]
        if recent:
            cls._failed_attempts[key] = recent
        else:
            cls._failed_attempts.pop(key, None)
        return recent

    @classmethod
    def _enforce_rate_limit_memory_cap(cls, now_ts: float) -> None:
        """Prevents unbounded growth of failed-attempt tracking memory under IP/username floods."""
        if len(cls._failed_attempts) <= cls._MAX_RATE_LIMIT_KEYS:
            return
        window = settings.ADMIN_LOGIN_WINDOW_SECONDS
        stale_keys = [
            k for k, timestamps in list(cls._failed_attempts.items())
            if not [ts for ts in timestamps if (now_ts - ts) < window]
        ]
        for k in stale_keys:
            cls._failed_attempts.pop(k, None)

        if len(cls._failed_attempts) > cls._MAX_RATE_LIMIT_KEYS:
            overflow = len(cls._failed_attempts) - cls._MAX_RATE_LIMIT_KEYS
            for k in list(cls._failed_attempts.keys())[:overflow]:
                cls._failed_attempts.pop(k, None)

    @classmethod
    def _is_rate_limited(cls, client_ip: str, username: str) -> bool:
        now_ts = time.time()
        max_attempts = settings.ADMIN_LOGIN_MAX_ATTEMPTS
        ip_attempts = cls._prune_attempts(f"ip:{client_ip}", now_ts)
        user_ip_attempts = cls._prune_attempts(f"user:{client_ip}:{username}", now_ts)
        user_global_attempts = cls._prune_attempts(f"user_global:{username}", now_ts) if username else []
        return (
            len(ip_attempts) >= (max_attempts * 2)
            or len(user_ip_attempts) >= max_attempts
            or len(user_global_attempts) >= (max_attempts * 2)
        )

    @classmethod
    def _record_failed_attempt(cls, client_ip: str, username: str) -> None:
        now_ts = time.time()
        cls._failed_attempts[f"ip:{client_ip}"].append(now_ts)
        cls._failed_attempts[f"user:{client_ip}:{username}"].append(now_ts)
        if username:
            cls._failed_attempts[f"user_global:{username}"].append(now_ts)
        cls._enforce_rate_limit_memory_cap(now_ts)

    @classmethod
    def _clear_attempts(cls, client_ip: str, username: str) -> None:
        cls._failed_attempts.pop(f"user:{client_ip}:{username}", None)
        if username:
            cls._failed_attempts.pop(f"user_global:{username}", None)

    # ====================================================================
    # Login & Session Resolution
    # ====================================================================
    @classmethod
    async def authenticate(cls, username: str, password: str, client_ip: str = "unknown") -> Dict[str, Any]:
        """Authenticates an administrator with rate limiting, scrypt verification, and audit logs."""
        normalized_username = (username or "").strip().lower()
        safe_ip = client_ip or "unknown"

        if cls._is_rate_limited(safe_ip, normalized_username):
            await db.add_log(
                event_type="admin_login_rate_limited",
                description=f"Rate limit exceeded for admin login attempt (username='{normalized_username}', ip='{safe_ip}').",
                status="warning",
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please try again later.",
            )

        admin = await db.get_admin_by_username(normalized_username)
        if not admin:
            # Perform dummy scrypt work to minimize timing difference
            hashlib.scrypt(
                (password or "").encode("utf-8"),
                salt=_DUMMY_SALT,
                n=SCRYPT_N,
                r=SCRYPT_R,
                p=SCRYPT_P,
                maxmem=SCRYPT_MAXMEM,
                dklen=SCRYPT_DKLEN,
            )
            cls._record_failed_attempt(safe_ip, normalized_username)
            await db.add_log(
                event_type="admin_login_failed",
                description=f"Failed admin login attempt for username='{normalized_username}' (invalid credentials).",
                status="warning",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            )

        if not cls.verify_password(password, admin.get("password_hash", "")):
            cls._record_failed_attempt(safe_ip, normalized_username)
            await db.add_log(
                event_type="admin_login_failed",
                description=f"Failed admin login attempt for username='{normalized_username}' (invalid credentials).",
                status="warning",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            )

        if not admin.get("is_active", False):
            cls._record_failed_attempt(safe_ip, normalized_username)
            await db.add_log(
                event_type="admin_login_failed",
                description=f"Blocked login for inactive administrator '{normalized_username}'.",
                status="warning",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator account is inactive. Please contact system support.",
            )

        cls._clear_attempts(safe_ip, normalized_username)
        updated_admin = await db.update_admin_last_login(admin["id"]) or admin
        token, ttl_seconds = cls.create_session_token(updated_admin)
        csrf_token = cls.derive_csrf_token(token)

        await db.add_log(
            event_type="admin_login_success",
            description=f"Administrator '{normalized_username}' signed in successfully.",
            status="success",
        )

        return {
            "admin": cls.sanitize_admin(updated_admin),
            "token": token,
            "csrf_token": csrf_token,
            "expires_in": ttl_seconds,
        }

    @classmethod
    async def validate_session_with_payload(cls, token: Optional[str]) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
        """Validates session cookie token (memory + persistent revocation) and returns (admin, payload)."""
        payload = cls.decode_and_verify_token(token or "")
        if not payload:
            return None

        if await db.is_token_jti_revoked(payload["jti"]):
            cls._revoked_jtis[payload["jti"]] = float(payload["exp"])
            return None

        admin = await db.get_admin_by_id(payload["sub"])
        if not admin or not admin.get("is_active", False):
            return None

        return cls.sanitize_admin(admin), payload

    @classmethod
    async def validate_session(cls, token: Optional[str]) -> Optional[Dict[str, Any]]:
        """Validates session cookie token and confirms admin still exists, is active, and token is unrevoked."""
        resolved = await cls.validate_session_with_payload(token)
        return resolved[0] if resolved else None

    # ====================================================================
    # Initial Admin Bootstrap (Idempotent & Env-Driven)
    # ====================================================================
    @classmethod
    async def bootstrap_from_env(cls) -> Optional[Dict[str, Any]]:
        """
        If ADMIN_BOOTSTRAP_USERNAME and either ADMIN_BOOTSTRAP_PASSWORD_HASH or
        ADMIN_BOOTSTRAP_PASSWORD are configured in environment and no admin users
        exist yet, creates the initial administrator securely without storing plaintext.
        """
        username = (settings.ADMIN_BOOTSTRAP_USERNAME or "").strip().lower()
        precomputed_hash = (settings.ADMIN_BOOTSTRAP_PASSWORD_HASH or "").strip()
        raw_password = settings.ADMIN_BOOTSTRAP_PASSWORD

        if not username or (not precomputed_hash and not raw_password):
            return None

        existing = await db.get_admin_by_username(username)
        if existing:
            return cls.sanitize_admin(existing)

        pw_hash = precomputed_hash if precomputed_hash.startswith("scrypt$") else cls.hash_password(raw_password)
        created = await db.create_admin_user(
            username=username,
            password_hash=pw_hash,
            full_name=settings.ADMIN_BOOTSTRAP_FULL_NAME,
            is_active=True,
        )
        await db.add_log(
            event_type="admin_bootstrapped",
            description=f"Initial administrator account '{username}' initialized securely.",
            status="info",
        )
        return cls.sanitize_admin(created)

    # ====================================================================
    # Google OAuth CSRF State Protection
    # ====================================================================
    @classmethod
    def issue_oauth_state(cls) -> str:
        """Generates a signed, single-use, 10-minute expiring OAuth state token."""
        now_ts = int(time.time())
        exp_ts = now_ts + 600
        nonce = secrets.token_urlsafe(16)
        payload = f"tz_oauth.{exp_ts}.{nonce}"
        sig = hmac.new(cls._get_signing_secret(), payload.encode("ascii"), hashlib.sha256).digest()
        cls._prune_oauth_states(now_ts)
        cls._pending_oauth_states[nonce] = float(exp_ts)
        return f"{payload}.{_b64url_encode(sig)}"

    @classmethod
    async def issue_oauth_state_async(cls, admin_id: Optional[str] = None) -> str:
        """Generates a signed OAuth state token and stores its single-use nonce persistently."""
        state = cls.issue_oauth_state()
        _, exp_str, nonce, _ = state.split(".")
        await db.store_oauth_state(nonce=nonce, exp_ts=float(exp_str), admin_id=admin_id)
        return state

    @classmethod
    def _prune_oauth_states(cls, now_ts: float) -> None:
        expired = [k for k, exp in cls._pending_oauth_states.items() if exp <= now_ts]
        for k in expired:
            cls._pending_oauth_states.pop(k, None)

    @classmethod
    def verify_oauth_state(cls, state: Optional[str]) -> bool:
        """Validates signed single-use OAuth state parameter and consumes its local nonce."""
        if not state or state.count(".") != 3:
            return False
        try:
            prefix, exp_str, nonce, sig_b64 = state.split(".")
            if prefix != "tz_oauth":
                return False
            exp_ts = int(exp_str)
            now_ts = time.time()
            if exp_ts <= now_ts:
                return False

            payload = f"{prefix}.{exp_str}.{nonce}".encode("ascii")
            expected_sig = hmac.new(cls._get_signing_secret(), payload, hashlib.sha256).digest()
            provided_sig = _b64url_decode(sig_b64)
            if not hmac.compare_digest(expected_sig, provided_sig):
                return False

            cls._prune_oauth_states(now_ts)
            if nonce in cls._pending_oauth_states:
                cls._pending_oauth_states.pop(nonce, None)
                return True
            return False
        except Exception:
            return False

    @classmethod
    async def verify_oauth_state_async(cls, state: Optional[str]) -> bool:
        """Validates signed single-use OAuth state across local memory and persistent storage."""
        if not state or state.count(".") != 3:
            return False
        try:
            prefix, exp_str, nonce, sig_b64 = state.split(".")
            if prefix != "tz_oauth":
                return False
            exp_ts = int(exp_str)
            now_ts = time.time()
            if exp_ts <= now_ts:
                return False

            payload = f"{prefix}.{exp_str}.{nonce}".encode("ascii")
            expected_sig = hmac.new(cls._get_signing_secret(), payload, hashlib.sha256).digest()
            provided_sig = _b64url_decode(sig_b64)
            if not hmac.compare_digest(expected_sig, provided_sig):
                return False

            cls._prune_oauth_states(now_ts)
            consumed_local = cls._pending_oauth_states.pop(nonce, None) is not None
            consumed_db = await db.consume_oauth_state(nonce=nonce)
            return consumed_local or consumed_db
        except Exception:
            return False
