"""
Google Business Profile Integration Module for Techzone Academy.
Implements Google OAuth 2.0 authorization, token exchange, account/location discovery,
review retrieval with star rating parsing, and automated reply publishing with bounded retries.
Includes high-fidelity test/sandbox mode when credentials are not yet configured in .env.
"""

import base64
import binascii
import subprocess
import sys
import tempfile
import httpx
import asyncio
import logging
import os
import json
import secrets
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlencode
from datetime import datetime, timezone
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ..config import settings

logger = logging.getLogger("google_business")

TOKEN_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".google_tokens.json")
_TOKEN_AAD = b"techzone-gbp-oauth-tokens-v1"
_SIMULATED_REVIEW_PREFIXES = ("sim_", "mock_", "g_sync_", "AbFvO_sample_")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage"
GOOGLE_ACCOUNTS_API_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
GOOGLE_LOCATIONS_API_URL = "https://mybusinessbusinessinformation.googleapis.com/v1"

# Rating mapping for Google API star rating enums
STAR_RATING_MAP = {
    "STAR_RATING_UNSPECIFIED": 0,
    "ONE": 1,
    "TWO": 2,
    "THREE": 3,
    "FOUR": 4,
    "FIVE": 5,
}

class GoogleBusinessProfileClient:
    def __init__(self, token_file: Optional[str] = None):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI
        self.account_id = settings.GOOGLE_ACCOUNT_ID
        self.location_id = settings.GOOGLE_LOCATION_ID
        self._token_file = token_file or TOKEN_FILE

        # In-memory runtime tokens (backend only, never exposed to client)
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.last_sync_at: Optional[str] = None
        self.is_mock_connected: bool = False

        # Load persisted tokens if available
        self._load_tokens_from_file()

    @staticmethod
    def _decode_encryption_key() -> Optional[bytes]:
        raw = (settings.GOOGLE_TOKEN_ENCRYPTION_KEY or "").strip()
        if not raw or raw.startswith("replace-with-"):
            return None
        padded = raw + "=" * (-len(raw) % 4)
        for decoder in (base64.urlsafe_b64decode, base64.b64decode):
            try:
                key_bytes = decoder(padded.encode("ascii"))
                if len(key_bytes) == 32:
                    return key_bytes
            except (binascii.Error, ValueError, UnicodeEncodeError):
                continue
        raise ValueError("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.")

    @classmethod
    def _encrypt_token_payload(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        key_bytes = cls._decode_encryption_key()
        if not key_bytes:
            raise ValueError("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured.")
        nonce = secrets.token_bytes(12)
        plaintext = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        ct = AESGCM(key_bytes).encrypt(nonce, plaintext, _TOKEN_AAD)
        return {
            "encrypted": True,
            "v": 1,
            "alg": "AES-256-GCM",
            "nonce": base64.urlsafe_b64encode(nonce).rstrip(b"=").decode("ascii"),
            "ciphertext": base64.urlsafe_b64encode(ct).rstrip(b"=").decode("ascii"),
        }

    @classmethod
    def _decrypt_token_payload(cls, envelope: Dict[str, Any]) -> Dict[str, Any]:
        key_bytes = cls._decode_encryption_key()
        if not key_bytes:
            raise ValueError("GOOGLE_TOKEN_ENCRYPTION_KEY is required to decrypt stored OAuth tokens.")
        if envelope.get("alg") != "AES-256-GCM" or int(envelope.get("v", 0)) != 1:
            raise ValueError("Unsupported token encryption envelope version or algorithm.")
        nonce_str = str(envelope.get("nonce") or "")
        ct_str = str(envelope.get("ciphertext") or "")
        nonce = base64.urlsafe_b64decode(nonce_str + "=" * (-len(nonce_str) % 4))
        ct = base64.urlsafe_b64decode(ct_str + "=" * (-len(ct_str) % 4))
        plaintext = AESGCM(key_bytes).decrypt(nonce, ct, _TOKEN_AAD)
        data = json.loads(plaintext.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Decrypted token payload is invalid.")
        return data

    def _load_tokens_from_file(self):
        """Loads persisted Google OAuth tokens, decrypting AES-256-GCM envelopes or migrating plaintext cleanly."""
        try:
            if not os.path.exists(self._token_file):
                return
            with open(self._token_file, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            if not isinstance(raw_data, dict):
                logger.warning("Stored Google token file has invalid format; ignoring.")
                return

            was_plaintext = not bool(raw_data.get("encrypted"))
            if raw_data.get("encrypted") is True:
                data = self._decrypt_token_payload(raw_data)
            else:
                data = raw_data

            self.access_token = data.get("access_token")
            self.refresh_token = data.get("refresh_token")
            if data.get("account_id") and not self.account_id:
                self.account_id = data.get("account_id")
            if data.get("location_id") and not self.location_id:
                self.location_id = data.get("location_id")

            # Transparently migrate existing plaintext tokens to AES-256-GCM without invalidating credentials
            if (
                was_plaintext
                and not getattr(self, "_isolated_test_mode", False)
                and "pytest" not in sys.modules
                and (self.access_token or self.refresh_token)
            ):
                try:
                    if self._decode_encryption_key():
                        self._save_tokens_to_file(force_write=True)
                except Exception:
                    logger.warning("Unable to auto-migrate plaintext OAuth tokens at startup; check GOOGLE_TOKEN_ENCRYPTION_KEY.")
        except Exception:
            logger.warning("Could not load stored Google OAuth tokens safely.")

    def _save_tokens_to_file(self, force_write: bool = False):
        """Atomically persists Google OAuth tokens encrypted with AES-256-GCM."""
        tmp_path: Optional[str] = None
        try:
            if getattr(self, "_isolated_test_mode", False):
                return
            if not (force_write or (self.has_credentials and (self.access_token or self.refresh_token))):
                return

            payload = {
                "access_token": self.access_token,
                "refresh_token": self.refresh_token,
                "account_id": self.account_id,
                "location_id": self.location_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            key_bytes = self._decode_encryption_key()
            if key_bytes:
                to_write = self._encrypt_token_payload(payload)
            else:
                if settings.ENVIRONMENT.lower() == "production":
                    raise ValueError("Refusing to persist unencrypted OAuth tokens in production without GOOGLE_TOKEN_ENCRYPTION_KEY.")
                logger.warning("GOOGLE_TOKEN_ENCRYPTION_KEY is not set; persisting OAuth tokens unencrypted in development.")
                to_write = payload

            target_dir = os.path.dirname(os.path.abspath(self._token_file)) or "."
            os.makedirs(target_dir, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=target_dir,
                prefix=".google_tokens.",
                suffix=".tmp",
                delete=False,
            ) as tmp:
                tmp_path = tmp.name
                json.dump(to_write, tmp, indent=2)
                tmp.flush()
                os.fsync(tmp.fileno())

            try:
                os.chmod(tmp_path, 0o600)
            except OSError:
                pass
            if os.name == "nt" and "pytest" not in sys.modules:
                try:
                    domain = os.environ.get("USERDOMAIN", "")
                    user = os.environ.get("USERNAME", "")
                    principal = f"{domain}\\{user}" if domain and user else user
                    if principal:
                        subprocess.run(
                            [
                                "icacls",
                                tmp_path,
                                "/inheritance:r",
                                "/grant:r",
                                f"{principal}:(F)",
                                "NT AUTHORITY\\SYSTEM:(F)",
                                "BUILTIN\\Administrators:(F)",
                            ],
                            check=False,
                            capture_output=True,
                            timeout=5,
                        )
                except Exception:
                    pass
            os.replace(tmp_path, self._token_file)
            tmp_path = None
        except Exception as e:
            logger.error(f"Could not persist Google OAuth tokens safely: {type(e).__name__}")
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    def _clear_tokens_file(self):
        """Deletes persisted Google OAuth tokens on disconnect (guarded against test suite erasure)."""
        try:
            if getattr(self, "_isolated_test_mode", False) or "pytest" in sys.modules:
                return
            if os.path.exists(self._token_file):
                os.remove(self._token_file)
        except Exception as e:
            logger.warning(f"Could not clear Google tokens file: {type(e).__name__}")

    @property
    def has_credentials(self) -> bool:
        """Checks if real Google OAuth client credentials are configured in .env."""
        return bool(
            self.client_id 
            and self.client_secret 
            and not self.client_id.startswith("your-")
        )

    def is_connected(self) -> bool:
        """Determines if the application currently has an active Google connection."""
        if self.has_credentials:
            return bool(self.access_token or self.refresh_token)
        return self.is_mock_connected

    # ====================================================================
    # OAuth 2.0 Authentication
    # ====================================================================
    def generate_auth_url(self, state: str = "techzone_csrf_state") -> str:
        """Generates Google OAuth 2.0 authorization URL requesting business.manage scope."""
        if not self.has_credentials:
            # Fallback to local OAuth simulator endpoint if credentials are not configured yet
            return f"http://localhost:8000/api/auth/google/callback?code=mock_google_auth_code&state={state}"

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_BUSINESS_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchanges authorization code for access and refresh tokens."""
        if not self.has_credentials or code.startswith("mock_"):
            self.is_mock_connected = True
            self.access_token = "mock_access_token_techzone_12345"
            self.refresh_token = "mock_refresh_token_techzone_67890"
            self.last_sync_at = datetime.now(timezone.utc).isoformat()
            if not self.account_id:
                self.account_id = "accounts/1098273491823749"
            if not self.location_id:
                self.location_id = "locations/892348723948234"
            return {
                "access_token": self.access_token,
                "refresh_token": self.refresh_token,
                "expires_in": 3600,
                "token_type": "Bearer"
            }

        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data=payload)
            if resp.status_code != 200:
                logger.error(f"Failed to exchange Google OAuth code (HTTP {resp.status_code}).")
                raise Exception(f"Google OAuth token exchange failed (HTTP {resp.status_code}).")
            
            data = resp.json()
            self.access_token = data.get("access_token")
            if data.get("refresh_token"):
                self.refresh_token = data.get("refresh_token")
            self.last_sync_at = datetime.now(timezone.utc).isoformat()
            self._save_tokens_to_file()
            return data

    async def refresh_access_token(self) -> Optional[str]:
        """Refreshes the OAuth access token using the stored refresh token, handling rotated refresh tokens."""
        if not self.refresh_token:
            return None

        if not self.has_credentials or self.refresh_token.startswith("mock_"):
            self.access_token = "mock_access_token_refreshed_" + datetime.now(timezone.utc).strftime("%H%M%S")
            return self.access_token

        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
            "grant_type": "refresh_token"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data=payload)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("access_token"):
                    self.access_token = data["access_token"]
                if data.get("refresh_token"):
                    self.refresh_token = data["refresh_token"]
                self._save_tokens_to_file()
                return self.access_token
            else:
                logger.error(f"Failed to refresh Google OAuth access token (HTTP {resp.status_code}).")
                return None

    def disconnect(self):
        """Disconnects the Google account and clears in-memory tokens and detected IDs."""
        if getattr(self, "_isolated_test_mode", False) or "pytest" in sys.modules:
            # During automated tests, isolate without erasing real persistent credentials
            self.access_token = None
            self.refresh_token = None
            self.is_mock_connected = False
            return

        self.access_token = None
        self.refresh_token = None
        self.is_mock_connected = False
        self.account_id = settings.GOOGLE_ACCOUNT_ID or None
        self.location_id = settings.GOOGLE_LOCATION_ID or None
        self._clear_tokens_file()

    # ====================================================================
    # Google Business Profile Information
    # ====================================================================
    def get_connection_info(self) -> Dict[str, Any]:
        """Returns safe connection metadata without leaking secret tokens."""
        acc = self.account_id
        loc = self.location_id
        if not self.has_credentials and not acc:
            acc = "accounts/1098273491823749"
        if not self.has_credentials and not loc:
            loc = "locations/892348723948234"

        return {
            "is_connected": self.is_connected(),
            "business_name": settings.BUSINESS_NAME,
            "account_id": acc,
            "location_id": loc,
            "status": "connected" if self.is_connected() else "disconnected",
            "has_credentials": self.has_credentials,
            "last_synced_at": self.last_sync_at,
            "api_scope": GOOGLE_BUSINESS_SCOPE
        }

    # ====================================================================
    # Account & Location Auto-Detection
    # ====================================================================
    async def discover_account_and_location(self, access_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Discovers accessible Google Business Profile accounts and locations using:
        1. Account Management API: GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts
        2. Business Information API: GET https://mybusinessbusinessinformation.googleapis.com/v1/{account_name}/locations?readMask=name,title,storefrontAddress

        Identifies Techzone Academy safely. Never guesses IDs.
        Handles single vs multiple accounts and locations, and flags ambiguous results.
        """
        token = access_token or self.access_token
        if not token:
            return {
                "status": "error",
                "error": "No active Google OAuth access token available for discovery."
            }

        # Sandbox / mock simulation branch
        if not self.has_credentials and token.startswith("mock_"):
            mock_acc = self.account_id or "accounts/1098273491823749"
            mock_loc = self.location_id or "locations/892348723948234"
            self.account_id = mock_acc
            self.location_id = mock_loc
            return {
                "status": "success",
                "account_id": mock_acc,
                "account_name": "Techzone Academy (Mock)",
                "location_id": mock_loc,
                "location_title": "Techzone Academy - Main Campus (Mock)",
                "is_mock": True
            }

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }

        # Step 1: Query Account Management API
        accounts = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(GOOGLE_ACCOUNTS_API_URL, headers=headers)
                if resp.status_code == 401 and self.refresh_token:
                    fresh_token = await self.refresh_access_token()
                    if fresh_token:
                        headers["Authorization"] = f"Bearer {fresh_token}"
                        token = fresh_token
                        resp = await client.get(GOOGLE_ACCOUNTS_API_URL, headers=headers)

                if resp.status_code != 200:
                    logger.error(f"Google Account Management API error: {resp.status_code} {resp.text}")
                    return {
                        "status": "error",
                        "error": f"Failed to retrieve Google accounts (HTTP {resp.status_code}): {resp.text}"
                    }

                acc_data = resp.json()
                accounts = acc_data.get("accounts", [])
        except Exception as e:
            logger.error(f"Network error querying Google Account Management API: {e}")
            return {
                "status": "error",
                "error": f"Network error querying Google Account Management API: {str(e)}"
            }

        if not accounts:
            return {
                "status": "no_accounts",
                "error": "No Google Business Profile accounts found for authenticated user."
            }

        # Identify account:
        selected_account = None
        if len(accounts) == 1:
            selected_account = accounts[0]
        else:
            # Filter accounts where "techzone" in accountName
            matching = [
                acc for acc in accounts
                if "techzone" in (acc.get("accountName") or "").lower()
            ]
            if len(matching) == 1:
                selected_account = matching[0]
            else:
                logger.warning(f"Multiple Google accounts returned without unique Techzone match: {[a.get('name') for a in accounts]}")
                return {
                    "status": "ambiguous_account",
                    "accounts": [
                        {"name": acc.get("name"), "accountName": acc.get("accountName")}
                        for acc in accounts
                    ],
                    "error": "Multiple Google Business accounts detected without a unique Techzone Academy match."
                }

        account_resource_name = selected_account.get("name", "")
        clean_acc_path = account_resource_name if account_resource_name.startswith("accounts/") else f"accounts/{account_resource_name}"
        account_display_name = selected_account.get("accountName") or clean_acc_path

        # Step 2: Query Business Information API for locations
        loc_url = f"{GOOGLE_LOCATIONS_API_URL}/{clean_acc_path}/locations"
        params = {"readMask": "name,title,storefrontAddress"}
        locations = []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(loc_url, headers=headers, params=params)
                if resp.status_code == 401 and self.refresh_token:
                    fresh_token = await self.refresh_access_token()
                    if fresh_token:
                        headers["Authorization"] = f"Bearer {fresh_token}"
                        resp = await client.get(loc_url, headers=headers, params=params)

                if resp.status_code != 200:
                    logger.error(f"Google Business Information API error: {resp.status_code} {resp.text}")
                    return {
                        "status": "error",
                        "account_id": clean_acc_path,
                        "account_name": account_display_name,
                        "error": f"Failed to retrieve locations for account {clean_acc_path} (HTTP {resp.status_code}): {resp.text}"
                    }

                loc_data = resp.json()
                locations = loc_data.get("locations", [])
        except Exception as e:
            logger.error(f"Network error querying Google Business Information API: {e}")
            return {
                "status": "error",
                "account_id": clean_acc_path,
                "account_name": account_display_name,
                "error": f"Network error querying Google Business Information API: {str(e)}"
            }

        if not locations:
            return {
                "status": "no_locations",
                "account_id": clean_acc_path,
                "account_name": account_display_name,
                "error": f"No locations found under account {account_display_name} ({clean_acc_path})."
            }

        # Identify location:
        selected_location = None
        if len(locations) == 1:
            selected_location = locations[0]
        else:
            # Filter locations where "techzone" in title
            matching_locs = [
                loc for loc in locations
                if "techzone" in (loc.get("title") or "").lower()
            ]
            if len(matching_locs) == 1:
                selected_location = matching_locs[0]
            else:
                candidate_locs = [
                    {"name": loc.get("name"), "title": loc.get("title")}
                    for loc in locations
                ]
                logger.warning(f"Multiple locations found under {clean_acc_path} without unique Techzone match: {candidate_locs}")
                return {
                    "status": "ambiguous_location",
                    "account_id": clean_acc_path,
                    "account_name": account_display_name,
                    "locations": candidate_locs,
                    "error": "Multiple locations detected under account without a unique Techzone Academy match."
                }

        location_resource_name = selected_location.get("name", "")
        location_title = selected_location.get("title") or location_resource_name

        # Store discovered IDs in client instance
        self.account_id = clean_acc_path
        self.location_id = location_resource_name

        return {
            "status": "success",
            "account_id": clean_acc_path,
            "account_name": account_display_name,
            "location_id": location_resource_name,
            "location_title": location_title
        }

    # ====================================================================
    # Review Star Rating Parser
    # ====================================================================
    @staticmethod
    def parse_star_rating(rating_val: Any) -> int:
        """
        Parses Google star rating into integer 1..5.
        Handles Google enum strings ('FIVE', 'FOUR', 'THREE', 'TWO', 'ONE')
        as well as direct integer/float representations.
        """
        if isinstance(rating_val, str):
            clean_str = rating_val.strip().upper()
            if clean_str in STAR_RATING_MAP:
                return STAR_RATING_MAP[clean_str]
            try:
                rating_val = int(clean_str)
            except ValueError:
                pass

        if isinstance(rating_val, (int, float)):
            stars = int(rating_val)
            if 1 <= stars <= 5:
                return stars

        raise ValueError(f"Unrecognized Google star rating value: {rating_val}")

    # ====================================================================
    # Review Retrieval
    # ====================================================================
    async def fetch_reviews(
        self,
        account_id: Optional[str] = None,
        location_id: Optional[str] = None,
        page_size: int = 50,
        fetch_all_pages: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Retrieves actual customer reviews from Google Business Profile API:
        GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews

        Features:
        - Automatic token loading from secure local token store
        - Automatic token refresh on 401 Unauthorized
        - Robust pagination using nextPageToken (up to max_pages=20)
        - Clean extraction of account ID and location ID
        - Strictly returns actual reviews when connected (never returns mock data in live mode)
        """
        # Ensure latest tokens are loaded
        if not self.access_token and os.path.exists(self._token_file):
            self._load_tokens_from_file()

        # If live credentials exist and we have an active connection
        if self.has_credentials and self.is_connected():
            if not self.access_token and self.refresh_token:
                await self.refresh_access_token()

            acc = account_id or self.account_id
            loc = location_id or self.location_id
            if not acc or not loc:
                logger.warning("Cannot fetch Google reviews: account_id or location_id is not set. Run auto-detection or configure .env.")
                return []

            acc_clean = acc.replace("accounts/", "").strip()
            loc_clean = loc.split("locations/")[-1].strip()
            base_url = f"https://mybusiness.googleapis.com/v4/accounts/{acc_clean}/locations/{loc_clean}/reviews"

            headers = {"Authorization": f"Bearer {self.access_token}"}
            all_reviews: List[Dict[str, Any]] = []
            page_token: Optional[str] = None
            max_pages = 20

            for page in range(max_pages):
                params: Dict[str, Any] = {"pageSize": page_size}
                if page_token:
                    params["pageToken"] = page_token

                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(base_url, headers=headers, params=params)

                        # Token expiration check
                        if resp.status_code == 401 and self.refresh_token:
                            fresh_token = await self.refresh_access_token()
                            if fresh_token:
                                headers["Authorization"] = f"Bearer {fresh_token}"
                                resp = await client.get(base_url, headers=headers, params=params)

                        if resp.status_code == 200:
                            data = resp.json()
                            batch = data.get("reviews", [])
                            all_reviews.extend(batch)
                            page_token = data.get("nextPageToken")
                            if not page_token or not fetch_all_pages:
                                break
                        elif resp.status_code == 404:
                            logger.warning(f"Google Business Profile location not found or reviews endpoint unavailable: {base_url}")
                            break
                        else:
                            logger.error(f"Google Reviews API error (HTTP {resp.status_code}): {resp.text}")
                            break
                except Exception as e:
                    logger.error(f"Network error communicating with Google Reviews API: {e}")
                    break

            self.last_sync_at = datetime.now(timezone.utc).isoformat()
            logger.info(f"Retrieved {len(all_reviews)} real customer reviews from Google Business Profile.")
            return all_reviews

        # Sandbox / Simulated review batch for testing when not connected
        sim_loc = location_id or self.location_id or "locations/892348723948234"
        self.last_sync_at = datetime.now(timezone.utc).isoformat()
        return self._generate_simulated_batch(sim_loc)

    def _generate_simulated_batch(self, location_id: str) -> List[Dict[str, Any]]:
        """Generates realistic new incoming Google reviews for sandbox verification ONLY when not connected."""
        if self.is_connected():
            logger.info("Live Google connection active. Mock review generation is strictly disabled.")
            return []

        timestamp = datetime.now(timezone.utc).isoformat()
        return [
            {
                "reviewId": f"g_sync_{int(datetime.now().timestamp())}_5",
                "reviewer": {"displayName": "Emily Watson"},
                "starRating": "FIVE",
                "comment": "Completed the Python full-stack certification. Hands down the best curriculum in the region!",
                "createTime": timestamp,
                "locationId": location_id,
            },
            {
                "reviewId": f"g_sync_{int(datetime.now().timestamp())}_2",
                "reviewer": {"displayName": "Daniel Craig"},
                "starRating": "TWO",
                "comment": "Good content but classroom projector had technical issues during two sessions.",
                "createTime": timestamp,
                "locationId": location_id,
            }
        ]

    # ====================================================================
    # Reply Publishing with Bounded Exponential Retries
    # ====================================================================
    async def publish_reply(
        self,
        review_id: str,
        reply_text: str,
        account_id: Optional[str] = None,
        location_id: Optional[str] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Publishes a predefined reply to Google Business Profile via:
        PUT https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
        Body: {"comment": reply_text}
        
        Strict Production Requirements:
        - Never returns simulated mock success.
        - Fails with a clear error if Google OAuth is disconnected.
        - Only returns success upon genuine HTTP 200/201 response from Google API.
        - Handles token refresh on 401 and exponential backoff on transient 429/5xx errors.
        """
        # Strict simulator/mock isolation: never publish synthetic review IDs to Google API
        if str(review_id or "").startswith(_SIMULATED_REVIEW_PREFIXES):
            logger.warning(f"Blocked attempt to publish reply for simulated review ID '{review_id}'.")
            return {
                "success": False,
                "error": "Simulated or mock review IDs cannot be published to Google Business Profile.",
                "status": "simulated_blocked",
            }

        # Ensure latest persisted tokens are loaded
        if not self.access_token and os.path.exists(self._token_file):
            self._load_tokens_from_file()

        # Strict check: Must have live credentials and active connection
        if not self.is_connected():
            logger.error("Cannot publish reply: Google Business Profile is disconnected. Valid Google OAuth authentication is required.")
            return {
                "success": False,
                "error": "Google Business Profile is disconnected. Valid Google OAuth authentication is required to publish replies.",
                "status": "disconnected"
            }

        # Auto-refresh if token expired or missing
        if not self.access_token and self.refresh_token:
            fresh = await self.refresh_access_token()
            if not fresh:
                return {
                    "success": False,
                    "error": "Failed to refresh expired Google OAuth access token. Please re-authenticate.",
                    "status": "auth_error"
                }

        acc = account_id or self.account_id
        loc = location_id or self.location_id
        if not acc or not loc:
            logger.error("Cannot publish reply: Google account_id or location_id is not configured or detected.")
            return {
                "success": False,
                "error": "Google Business Profile account_id or location_id is not configured/detected.",
                "status": "failed"
            }

        acc_clean = acc.replace("accounts/", "").strip()
        loc_clean = loc.split("locations/")[-1].strip()
        url = f"https://mybusiness.googleapis.com/v4/accounts/{acc_clean}/locations/{loc_clean}/reviews/{review_id}/reply"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        payload = {"comment": reply_text}

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.put(url, headers=headers, json=payload)
                    
                    # Handle token expiration (401)
                    if resp.status_code == 401 and self.refresh_token:
                        fresh = await self.refresh_access_token()
                        if fresh:
                            headers["Authorization"] = f"Bearer {fresh}"
                            resp = await client.put(url, headers=headers, json=payload)

                    if resp.status_code in (200, 201):
                        resp_data = resp.json() if resp.content else {}
                        logger.info(f"Successfully published reply for review {review_id} on Google (HTTP {resp.status_code}).")
                        return {
                            "success": True,
                            "http_status": resp.status_code,
                            "response": resp_data,
                            "comment": resp_data.get("comment", reply_text),
                            "update_time": resp_data.get("updateTime"),
                            "attempts": attempt
                        }

                    # Transient retry on 429 rate limit or 5xx server error
                    if resp.status_code in (429, 500, 502, 503, 504):
                        wait_time = (2 ** (attempt - 1))  # 1s, 2s, 4s
                        logger.warning(f"Google API transient error {resp.status_code}. Retrying in {wait_time}s (attempt {attempt}/{max_retries})...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        # Non-retriable 4xx error (400 Bad Request, 403 Forbidden, 404 Review Not Found)
                        logger.error(f"Non-retriable Google API error HTTP {resp.status_code} for review {review_id}.")
                        return {
                            "success": False,
                            "http_status": resp.status_code,
                            "error": f"Google API error HTTP {resp.status_code}",
                            "attempts": attempt
                        }
            except Exception as e:
                last_error = type(e).__name__
                wait_time = (2 ** (attempt - 1))
                await asyncio.sleep(wait_time)

        return {
            "success": False,
            "error": f"Publishing failed after {max_retries} attempts ({last_error or 'upstream_error'}).",
            "attempts": max_retries
        }

    # ====================================================================
    # Google-side Review & Reply Verification
    # ====================================================================
    async def get_review(
        self,
        review_id: str,
        account_id: Optional[str] = None,
        location_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves a single review from Google Business Profile to verify reviewReply existence and state:
        GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
        """
        if not self.access_token and os.path.exists(self._token_file):
            self._load_tokens_from_file()

        if not self.is_connected():
            return {
                "success": False,
                "error": "Google Business Profile is disconnected.",
                "status": "disconnected"
            }

        if not self.access_token and self.refresh_token:
            await self.refresh_access_token()

        acc = account_id or self.account_id
        loc = location_id or self.location_id
        if not acc or not loc:
            return {
                "success": False,
                "error": "Missing account_id or location_id for review verification."
            }

        acc_clean = acc.replace("accounts/", "").strip()
        loc_clean = loc.split("locations/")[-1].strip()
        url = f"https://mybusiness.googleapis.com/v4/accounts/{acc_clean}/locations/{loc_clean}/reviews/{review_id}"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401 and self.refresh_token:
                    fresh = await self.refresh_access_token()
                    if fresh:
                        headers["Authorization"] = f"Bearer {fresh}"
                        resp = await client.get(url, headers=headers)

                if resp.status_code == 200:
                    review_data = resp.json()
                    reply_obj = review_data.get("reviewReply")
                    return {
                        "success": True,
                        "http_status": 200,
                        "review": review_data,
                        "has_reply": bool(reply_obj),
                        "review_reply": reply_obj,
                        "reply_comment": reply_obj.get("comment") if reply_obj else None,
                        "update_time": reply_obj.get("updateTime") if reply_obj else None,
                        "reply_state": review_data.get("reviewReplyState") or ("published" if reply_obj else "unreplied"),
                        "policy_violation": review_data.get("policyViolation") or (reply_obj.get("policyViolation") if reply_obj else None)
                    }
                else:
                    return {
                        "success": False,
                        "http_status": resp.status_code,
                        "error": f"Failed to retrieve review from Google: HTTP {resp.status_code}"
                    }
        except Exception as e:
            return {
                "success": False,
                "error": f"Network error verifying review with Google ({type(e).__name__})."
            }

google_client = GoogleBusinessProfileClient()
