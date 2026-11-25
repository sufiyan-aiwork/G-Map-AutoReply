"""
Database Integration Layer for Supabase PostgreSQL.
Communicates with Supabase Cloud via PostgREST and joins reviews with published replies.
Includes local fallback for offline development.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import quote
import httpx
from ..config import settings

logger = logging.getLogger("supabase_client")

INITIAL_TEMPLATES = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "category": "positive",
        "reply_text": "Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!",
        "applicable_ratings": [3, 4, 5],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "category": "negative",
        "reply_text": "We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services.",
        "applicable_ratings": [1, 2],
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
]

INITIAL_BUSINESS_CONFIG = {
    "id": "33333333-3333-3333-3333-333333333333",
    "business_name": "Techzone Academy",
    "google_account_id": settings.GOOGLE_ACCOUNT_ID or None,
    "google_location_id": settings.GOOGLE_LOCATION_ID or None,
    "auto_reply_enabled": True,
    "polling_interval": 15,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat()
}

INITIAL_SAMPLE_REVIEWS = [
    {
        "id": "44444444-4444-4444-4444-000000000005",
        "google_review_id": "AbFvO_sample_501",
        "location_id": "locations/4001506839118937948",
        "star_rating": 5,
        "review_text": "Outstanding Python & Full-Stack training at Techzone Academy! The instructors are true industry experts and the hands-on projects helped me secure my first developer role.",
        "reviewer_name": "David Miller",
        "review_created_at": datetime.now(timezone.utc).isoformat(),
        "processing_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "matched_reply": None,
        "publishing_status": "pending",
        "reply_published_at": None
    },
    {
        "id": "44444444-4444-4444-4444-000000000004",
        "google_review_id": "AbFvO_sample_401",
        "location_id": "locations/4001506839118937948",
        "star_rating": 4,
        "review_text": "Great curriculum and friendly mentoring. Would have loved a few more backend deployment workshops, but overall really satisfied with my experience.",
        "reviewer_name": "Sarah Jenkins",
        "review_created_at": datetime.now(timezone.utc).isoformat(),
        "processing_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "matched_reply": None,
        "publishing_status": "pending",
        "reply_published_at": None
    },
    {
        "id": "44444444-4444-4444-4444-000000000003",
        "google_review_id": "AbFvO_sample_301",
        "location_id": "locations/4001506839118937948",
        "star_rating": 3,
        "review_text": "The course content was good, but the lab computer scheduling could be improved during peak exam weeks.",
        "reviewer_name": "Michael Tan",
        "review_created_at": datetime.now(timezone.utc).isoformat(),
        "processing_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "matched_reply": None,
        "publishing_status": "pending",
        "reply_published_at": None
    },
    {
        "id": "44444444-4444-4444-4444-000000000002",
        "google_review_id": "AbFvO_sample_201",
        "location_id": "locations/4001506839118937948",
        "star_rating": 2,
        "review_text": "Had trouble receiving my certificate after completion. Took two weeks of follow ups with the administration office.",
        "reviewer_name": "Jessica Lee",
        "review_created_at": datetime.now(timezone.utc).isoformat(),
        "processing_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "matched_reply": None,
        "publishing_status": "pending",
        "reply_published_at": None
    },
    {
        "id": "44444444-4444-4444-4444-000000000001",
        "google_review_id": "AbFvO_sample_101",
        "location_id": "locations/4001506839118937948",
        "star_rating": 1,
        "review_text": "Class timings were changed twice without prior notice. Disappointed with the communication.",
        "reviewer_name": "Robert Evans",
        "review_created_at": datetime.now(timezone.utc).isoformat(),
        "processing_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "matched_reply": None,
        "publishing_status": "pending",
        "reply_published_at": None
    }
]

INITIAL_SYSTEM_LOGS = [
    {
        "id": str(uuid.uuid4()),
        "event_type": "system_startup",
        "description": "Techzone Review Reply Automation System connected to Supabase PostgreSQL.",
        "status": "info",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

class DatabaseClient:
    """Unified client supporting both live Supabase Cloud PostgREST and local memory fallback."""

    def __init__(self):
        self.supabase_url = (settings.SUPABASE_URL or "").strip()
        self.supabase_key = (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY or "").strip()
        self.is_connected_to_supabase = bool(
            self.supabase_url 
            and self.supabase_key 
            and not self.supabase_url.startswith("https://your-")
        )
        
        # Local fallback store
        self._templates: List[Dict[str, Any]] = [dict(t) for t in INITIAL_TEMPLATES]
        self._business_config: Dict[str, Any] = dict(INITIAL_BUSINESS_CONFIG)
        self._reviews: List[Dict[str, Any]] = [dict(r) for r in INITIAL_SAMPLE_REVIEWS]
        self._published_replies: List[Dict[str, Any]] = []
        self._logs: List[Dict[str, Any]] = [dict(l) for l in INITIAL_SYSTEM_LOGS]
        self._admin_users: List[Dict[str, Any]] = []
        self._isolated_test_mode: bool = False

    def _get_headers(self) -> Dict[str, str]:
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    # ==========================
    # Connection Health Check
    # ==========================
    async def check_connection_status(self) -> Dict[str, Any]:
        """Inspects live Supabase connectivity and table status."""
        if not self.is_connected_to_supabase:
            return {
                "configured": False,
                "status": "offline_mode",
                "message": "Supabase credentials are not configured; using local memory store."
            }

        tables = ["reply_templates", "reviews", "published_replies", "business_config", "system_logs"]
        table_status = {}
        all_tables_ready = True

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                root_res = await client.get(f"{self.supabase_url}/rest/v1/", headers=self._get_headers())
                if root_res.status_code != 200:
                    return {
                        "configured": True,
                        "connected": False,
                        "status": "auth_error",
                        "error": f"HTTP {root_res.status_code}: {root_res.text}"
                    }

                for t in tables:
                    t_res = await client.get(f"{self.supabase_url}/rest/v1/{t}?select=id&limit=1", headers=self._get_headers())
                    if t_res.status_code == 200:
                        table_status[t] = "active"
                    else:
                        table_status[t] = "missing"
                        all_tables_ready = False

            return {
                "configured": True,
                "connected": True,
                "supabase_url": self.supabase_url,
                "tables_ready": all_tables_ready,
                "tables": table_status,
                "status": "ready" if all_tables_ready else "pending_sql_schema",
                "message": "Connected to Supabase! All 5 tables are active and ready." if all_tables_ready else "Connected to Supabase, but some tables are missing."
            }
        except Exception as e:
            return {
                "configured": True,
                "connected": False,
                "status": "connection_error",
                "error": str(e)
            }

    # ==========================
    # Templates
    # ==========================
    async def get_templates(self) -> List[Dict[str, Any]]:
        if self.is_connected_to_supabase:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/reply_templates?select=*",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if len(data) >= 2:
                            return data
            except Exception as e:
                logger.warning(f"Failed to fetch templates from Supabase: {e}")
        return self._templates

    async def get_template_by_category(self, category: str) -> Optional[Dict[str, Any]]:
        templates = await self.get_templates()
        for t in templates:
            if t.get("category") == category:
                return t
        return None

    async def update_template(self, category: str, reply_text: Optional[str] = None, is_active: Optional[bool] = None) -> Optional[Dict[str, Any]]:
        now_str = datetime.now(timezone.utc).isoformat()
        
        # Local update
        target = None
        for t in self._templates:
            if t["category"] == category:
                if reply_text is not None:
                    t["reply_text"] = reply_text
                if is_active is not None:
                    t["is_active"] = is_active
                t["updated_at"] = now_str
                target = t
                break
                
        # Remote Supabase update
        if self.is_connected_to_supabase and target:
            try:
                update_payload = {"updated_at": now_str}
                if reply_text is not None:
                    update_payload["reply_text"] = reply_text
                if is_active is not None:
                    update_payload["is_active"] = is_active
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.patch(
                        f"{self.supabase_url}/rest/v1/reply_templates?category=eq.{category}",
                        headers=self._get_headers(),
                        json=update_payload
                    )
            except Exception as e:
                logger.warning(f"Could not patch Supabase reply_template '{category}': {e}")
                
        return target

    # ==========================
    # Reviews
    # ==========================
    async def get_reviews(
        self,
        rating: Optional[int] = None,
        status: Optional[str] = None,
        location_id: Optional[str] = None,
        genuine_only: bool = False
    ) -> List[Dict[str, Any]]:
        if self.is_connected_to_supabase:
            try:
                params = ["select=*,published_replies(*)"]
                if rating is not None:
                    params.append(f"star_rating=eq.{rating}")
                if status is not None:
                    params.append(f"processing_status=eq.{status}")
                if location_id is not None:
                    params.append(f"location_id=eq.{location_id}")
                if genuine_only:
                    params.append("google_review_id=like.AbFvO*")
                query_str = "&".join(params)
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/reviews?{query_str}&order=review_created_at.desc.nullslast",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        # Map joined published_replies to review properties
                        for r in data:
                            pubs = r.get("published_replies", [])
                            if pubs and len(pubs) > 0:
                                successful_pub = next((p for p in pubs if p.get("publishing_status") == "published"), None)
                                if successful_pub:
                                    r["matched_reply"] = successful_pub.get("reply_text")
                                    r["publishing_status"] = "published"
                                    r["reply_published_at"] = successful_pub.get("google_published_at")
                                else:
                                    verif_pub = next((p for p in pubs if p.get("publishing_status") == "pending" and p.get("error_message") in ("verification_pending", "awaiting_google_verification")), None)
                                    if verif_pub:
                                        r["matched_reply"] = verif_pub.get("reply_text")
                                        r["publishing_status"] = "verification_pending"
                                        r["reply_published_at"] = None
                                    else:
                                        latest_pub = pubs[0]
                                        r["publishing_status"] = latest_pub.get("publishing_status")
                                        r["matched_reply"] = None
                                        r["reply_published_at"] = None
                        
                        if genuine_only:
                            data = [r for r in data if r.get("google_review_id", "").startswith("AbFvO")]
                        if location_id:
                            data = [r for r in data if r.get("location_id") == location_id]

                        if len(data) > 0 or genuine_only:
                            data.sort(
                                key=lambda r: r.get("reply_published_at") or r.get("review_created_at") or r.get("created_at") or "",
                                reverse=True
                            )
                            return data
            except Exception as e:
                logger.warning(f"Failed to fetch reviews from Supabase: {e}")

        results = self._reviews
        if rating is not None:
            results = [r for r in results if r.get("star_rating") == rating]
        if status is not None:
            results = [r for r in results if r.get("processing_status") == status]
        if location_id is not None:
            results = [r for r in results if r.get("location_id") == location_id]
        if genuine_only:
            gen = [r for r in results if r.get("google_review_id", "").startswith("AbFvO")]
            if gen:
                results = gen
        return sorted(results, key=lambda r: r.get("reply_published_at") or r.get("review_created_at") or r.get("created_at", ""), reverse=True)

    async def get_review_by_id(self, review_id: str) -> Optional[Dict[str, Any]]:
        if self.is_connected_to_supabase:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/reviews?id=eq.{review_id}&select=*,published_replies(*)",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200 and len(resp.json()) > 0:
                        r = resp.json()[0]
                        pubs = r.get("published_replies", [])
                        if pubs and len(pubs) > 0:
                            successful_pub = next((p for p in pubs if p.get("publishing_status") == "published"), None)
                            if successful_pub:
                                r["matched_reply"] = successful_pub.get("reply_text")
                                r["publishing_status"] = "published"
                                r["reply_published_at"] = successful_pub.get("google_published_at")
                            else:
                                verif_pub = next((p for p in pubs if p.get("publishing_status") == "pending" and p.get("error_message") in ("verification_pending", "awaiting_google_verification")), None)
                                if verif_pub:
                                    r["matched_reply"] = verif_pub.get("reply_text")
                                    r["publishing_status"] = "verification_pending"
                                    r["reply_published_at"] = None
                                else:
                                    latest_pub = pubs[0]
                                    r["publishing_status"] = latest_pub.get("publishing_status")
                                    r["matched_reply"] = None
                                    r["reply_published_at"] = None
                        return r
            except Exception:
                pass

        for r in self._reviews:
            if r.get("id") == review_id or r.get("google_review_id") == review_id:
                return r
        return None

    async def review_exists(self, location_id: str, google_review_id: str) -> bool:
        if self.is_connected_to_supabase:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/reviews?location_id=eq.{location_id}&google_review_id=eq.{google_review_id}&select=id",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200 and len(resp.json()) > 0:
                        return True
            except Exception:
                pass

        for r in self._reviews:
            if r.get("location_id") == location_id and r.get("google_review_id") == google_review_id:
                return True
        return False

    async def create_review(self, review_data: Dict[str, Any]) -> Dict[str, Any]:
        now_str = datetime.now(timezone.utc).isoformat()
        new_review = {
            "id": review_data.get("id") or str(uuid.uuid4()),
            "google_review_id": review_data["google_review_id"],
            "location_id": review_data["location_id"],
            "star_rating": review_data["star_rating"],
            "review_text": review_data.get("review_text"),
            "reviewer_name": review_data.get("reviewer_name", "Valued Customer"),
            "review_created_at": review_data.get("review_created_at") or now_str,
            "processing_status": review_data.get("processing_status", "pending"),
            "created_at": now_str,
            "updated_at": now_str,
            "matched_reply": review_data.get("matched_reply"),
            "publishing_status": review_data.get("publishing_status"),
            "reply_published_at": review_data.get("reply_published_at")
        }
        self._reviews.insert(0, new_review)

        # Test data separation safeguard:
        # Development simulator records (e.g. sim_rev_*) and mock/sync test records
        # are kept in the local in-memory store and never pollute production Supabase.
        is_test_review = new_review["google_review_id"].startswith(("sim_", "g_sync_", "mock_", "google_rev_"))
        if self.is_connected_to_supabase and not is_test_review:
            try:
                # Insert only table schema columns into Supabase
                cols = ['id', 'google_review_id', 'location_id', 'star_rating', 'review_text', 'reviewer_name', 'review_created_at', 'processing_status', 'created_at', 'updated_at']
                clean_payload = {k: new_review[k] for k in cols if k in new_review}
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/reviews",
                        headers=self._get_headers(),
                        json=clean_payload
                    )
            except Exception as e:
                logger.warning(f"Could not persist review to Supabase: {e}")

        return new_review

    async def update_review_status(self, review_id: str, status: str, matched_reply: Optional[str] = None, publishing_status: Optional[str] = None, reply_published_at: Optional[str] = None) -> Optional[Dict[str, Any]]:
        now_str = datetime.now(timezone.utc).isoformat()
        target = None
        for r in self._reviews:
            if r["id"] == review_id:
                r["processing_status"] = status
                if matched_reply:
                    r["matched_reply"] = matched_reply
                if publishing_status:
                    r["publishing_status"] = publishing_status
                if publishing_status == "published":
                    r["reply_published_at"] = reply_published_at or now_str
                r["updated_at"] = now_str
                target = r
                break

        if self.is_connected_to_supabase:
            try:
                update_payload = {
                    "processing_status": status,
                    "updated_at": now_str
                }
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.patch(
                        f"{self.supabase_url}/rest/v1/reviews?id=eq.{review_id}",
                        headers=self._get_headers(),
                        json=update_payload
                    )
            except Exception as e:
                logger.warning(f"Could not update review status in Supabase: {e}")

        return target

    # ==========================
    # Published Replies
    # ==========================
    async def record_published_reply(self, review_id: str, reply_text: str, status: str = "published", error_message: Optional[str] = None) -> Dict[str, Any]:
        now_str = datetime.now(timezone.utc).isoformat()

        # Supabase check constraint only allows ('published', 'failed', 'pending')
        # Map 'verification_pending' to allowed database status 'pending'
        # while preserving distinction via error_message='verification_pending'
        db_status = "pending" if status == "verification_pending" else status
        db_error = error_message or ("verification_pending" if status == "verification_pending" else None)

        record = {
            "id": str(uuid.uuid4()),
            "review_id": review_id,
            "reply_text": reply_text,
            "publishing_status": db_status,
            "google_published_at": now_str if status == "published" else None,
            "error_message": db_error,
            "created_at": now_str
        }
        self._published_replies.append(record)

        # Only persist to Supabase if not a test review (genuine reviews only)
        test_ids = {r["id"] for r in self._reviews if r.get("google_review_id", "").startswith(("sim_", "g_sync_", "mock_", "google_rev_", "AbFvO_sample_"))}
        if self.is_connected_to_supabase and review_id not in test_ids:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/published_replies",
                        headers=self._get_headers(),
                        json=record
                    )
            except Exception as e:
                logger.warning(f"Could not record published reply in Supabase: {e}")

        record_copy = dict(record)
        record_copy["publishing_status"] = status
        return record_copy

    async def update_published_reply(self, review_id: str, status: str = "published", google_published_at: Optional[str] = None) -> Optional[Dict[str, Any]]:
        now_str = datetime.now(timezone.utc).isoformat()
        target = None
        for p in self._published_replies:
            if p.get("review_id") == review_id:
                p["publishing_status"] = status
                p["google_published_at"] = google_published_at or now_str
                p["error_message"] = None
                target = p
                break

        if self.is_connected_to_supabase:
            try:
                patch_payload = {
                    "publishing_status": status,
                    "google_published_at": google_published_at or now_str,
                    "error_message": None
                }
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.patch(
                        f"{self.supabase_url}/rest/v1/published_replies?review_id=eq.{review_id}",
                        headers=self._get_headers(),
                        json=patch_payload
                    )
            except Exception as e:
                logger.warning(f"Could not update published reply in Supabase: {e}")

        return target

    # ==========================
    # Business Config & Automation
    # ==========================
    async def get_business_config(self) -> Dict[str, Any]:
        acc = self._business_config.get("google_account_id") or ""
        loc = self._business_config.get("google_location_id") or ""
        if "auto_detected_" in acc or "auto_detected_" in loc:
            return self._business_config
        if self.is_connected_to_supabase:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/business_config?select=*&limit=1",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200 and len(resp.json()) > 0:
                        return resp.json()[0]
            except Exception:
                pass
        return self._business_config

    async def update_business_config(
        self,
        auto_reply_enabled: Optional[bool] = None,
        polling_interval: Optional[int] = None,
        google_account_id: Optional[str] = None,
        google_location_id: Optional[str] = None
    ) -> Dict[str, Any]:
        now_str = datetime.now(timezone.utc).isoformat()
        if auto_reply_enabled is not None:
            self._business_config["auto_reply_enabled"] = auto_reply_enabled
        if polling_interval is not None:
            self._business_config["polling_interval"] = polling_interval
        if google_account_id is not None:
            self._business_config["google_account_id"] = google_account_id
        if google_location_id is not None:
            self._business_config["google_location_id"] = google_location_id
        self._business_config["updated_at"] = now_str

        # Safeguard: Do NOT overwrite live Supabase business_config with mock test IDs
        is_mock_test_id = (
            (google_account_id and "auto_detected_" in google_account_id) or
            (google_location_id and "auto_detected_" in google_location_id)
        )
        if self.is_connected_to_supabase and not is_mock_test_id:
            try:
                patch_data = {"updated_at": now_str}
                if auto_reply_enabled is not None:
                    patch_data["auto_reply_enabled"] = auto_reply_enabled
                if polling_interval is not None:
                    patch_data["polling_interval"] = polling_interval
                if google_account_id is not None:
                    patch_data["google_account_id"] = google_account_id
                if google_location_id is not None:
                    patch_data["google_location_id"] = google_location_id
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.patch(
                        f"{self.supabase_url}/rest/v1/business_config?business_name=eq.Techzone%20Academy",
                        headers=self._get_headers(),
                        json=patch_data
                    )
            except Exception as e:
                logger.warning(f"Could not patch Supabase business_config: {e}")

        return self._business_config

    # ==========================
    # Logs
    # ==========================
    async def add_log(self, event_type: str, description: str, status: str = "info") -> Dict[str, Any]:
        record = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "description": description,
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        self._logs.insert(0, record)

        if self.is_connected_to_supabase:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/system_logs",
                        headers=self._get_headers(),
                        json=record
                    )
            except Exception:
                pass

        return record

    async def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        if self.is_connected_to_supabase:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/system_logs?select=*&order=created_at.desc&limit={limit}",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200 and len(resp.json()) > 0:
                        return resp.json()
            except Exception:
                pass
        return self._logs[:limit]

    # ==========================
    # Admin Users
    # ==========================
    async def get_admin_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        normalized = (username or "").strip().lower()
        if not normalized:
            return None
        is_test_admin = self._isolated_test_mode or normalized.startswith(("test_", "pytest_"))
        if self.is_connected_to_supabase and not is_test_admin:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/admin_users?username=eq.{quote(normalized, safe='')}&select=*&limit=1",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200:
                        rows = resp.json()
                        if rows:
                            return rows[0]
                        return None
                    elif resp.status_code == 404:
                        logger.warning("Supabase admin_users table not found; execute docs/admin_auth_migration.sql in SQL Editor.")
            except Exception as e:
                logger.warning(f"Failed to query admin_users from Supabase: {e}")

        for u in self._admin_users:
            if u.get("username") == normalized:
                return u
        return None

    async def get_admin_by_id(self, admin_id: str) -> Optional[Dict[str, Any]]:
        if not admin_id:
            return None
        is_test_id = self._isolated_test_mode or admin_id.startswith(("test_", "pytest_"))
        if self.is_connected_to_supabase and not is_test_id:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(
                        f"{self.supabase_url}/rest/v1/admin_users?id=eq.{quote(admin_id, safe='')}&select=*&limit=1",
                        headers=self._get_headers()
                    )
                    if resp.status_code == 200:
                        rows = resp.json()
                        if rows:
                            return rows[0]
                        return None
            except Exception:
                pass

        for u in self._admin_users:
            if u.get("id") == admin_id:
                return u
        return None

    async def create_admin_user(
        self,
        username: str,
        password_hash: str,
        full_name: str = "Techzone Administrator",
        is_active: bool = True,
        admin_id: Optional[str] = None
    ) -> Dict[str, Any]:
        now_str = datetime.now(timezone.utc).isoformat()
        normalized = (username or "").strip().lower()
        is_test_admin = self._isolated_test_mode or normalized.startswith(("test_", "pytest_"))

        record = {
            "id": admin_id or (f"test_admin_{uuid.uuid4().hex[:8]}" if is_test_admin else str(uuid.uuid4())),
            "username": normalized,
            "password_hash": password_hash,
            "full_name": full_name,
            "is_active": is_active,
            "last_login_at": None,
            "created_at": now_str,
            "updated_at": now_str,
        }
        self._admin_users = [u for u in self._admin_users if u.get("username") != normalized]
        self._admin_users.append(record)

        if self.is_connected_to_supabase and not is_test_admin:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.post(
                        f"{self.supabase_url}/rest/v1/admin_users",
                        headers=self._get_headers(),
                        json=record
                    )
                    if resp.status_code in (200, 201) and resp.json():
                        return resp.json()[0]
                    elif resp.status_code == 404:
                        logger.warning("Supabase admin_users table not found; execute docs/admin_auth_migration.sql in SQL Editor.")
            except Exception as e:
                logger.warning(f"Could not create admin user in Supabase: {e}")

        return record

    async def update_admin_last_login(self, admin_id: str) -> Optional[Dict[str, Any]]:
        now_str = datetime.now(timezone.utc).isoformat()
        target = None
        for u in self._admin_users:
            if u.get("id") == admin_id:
                u["last_login_at"] = now_str
                u["updated_at"] = now_str
                target = u
                break

        is_test_id = self._isolated_test_mode or admin_id.startswith(("test_", "pytest_"))
        if self.is_connected_to_supabase and not is_test_id:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.patch(
                        f"{self.supabase_url}/rest/v1/admin_users?id=eq.{quote(admin_id, safe='')}",
                        headers=self._get_headers(),
                        json={"last_login_at": now_str, "updated_at": now_str}
                    )
                    if resp.status_code == 200 and resp.json():
                        return resp.json()[0]
            except Exception:
                pass
        return target

    async def update_admin_password(
        self,
        admin_id: str,
        password_hash: str,
        full_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        now_str = datetime.now(timezone.utc).isoformat()
        target = None
        for u in self._admin_users:
            if u.get("id") == admin_id:
                u["password_hash"] = password_hash
                if full_name is not None:
                    u["full_name"] = full_name
                u["updated_at"] = now_str
                target = u
                break

        is_test_id = self._isolated_test_mode or admin_id.startswith(("test_", "pytest_"))
        if self.is_connected_to_supabase and not is_test_id:
            try:
                patch_data = {"password_hash": password_hash, "updated_at": now_str}
                if full_name is not None:
                    patch_data["full_name"] = full_name
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.patch(
                        f"{self.supabase_url}/rest/v1/admin_users?id=eq.{quote(admin_id, safe='')}",
                        headers=self._get_headers(),
                        json=patch_data
                    )
                    if resp.status_code == 200 and resp.json():
                        return resp.json()[0]
            except Exception:
                pass
        return target

# Singleton instance
db = DatabaseClient()
