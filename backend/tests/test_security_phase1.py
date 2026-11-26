"""
Phase 1 Security Remediation Verification Tests:
- Supabase DatabaseClient strictly enforces SUPABASE_SERVICE_ROLE_KEY (never falls back to anon key).
- Schema SQL and security_rls_migration.sql restrict access strictly to service_role (no anon/authenticated grants or unscoped policies).
- certifi version >= 2026.11.20 and TLS bundle compatibility with httpx, requests, and google-auth.
- .gitignore protects .env, .google_tokens.json, and docs/backup/.
"""

from pathlib import Path
import re
import ssl
import certifi
import httpx
import requests
import google.auth.transport.requests
import pytest

from app.config import settings
from app.integrations.supabase_client import DatabaseClient


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_supabase_client_requires_service_role_key(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example-project.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "anon_only_key_12345")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)

    client = DatabaseClient()
    assert client.is_connected_to_supabase is False
    assert client.supabase_key == ""


def test_supabase_client_rejects_placeholder_service_role_key(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example-project.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "anon_only_key_12345")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "your-service-role-secret-key")

    client = DatabaseClient()
    assert client.is_connected_to_supabase is False
    assert client.supabase_key == ""


def test_supabase_client_uses_service_role_key_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example-project.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "anon_key_should_not_be_used")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "service_role_secret_value")

    client = DatabaseClient()
    assert client.is_connected_to_supabase is True
    assert client.supabase_key == "service_role_secret_value"


@pytest.mark.parametrize(
    "sql_rel_path",
    [
        "docs/supabase_schema.sql",
        "docs/security_rls_migration.sql",
        "docs/admin_auth_migration.sql",
    ],
)
def test_supabase_sql_restricts_policies_to_service_role(sql_rel_path):
    sql_text = (REPO_ROOT / sql_rel_path).read_text(encoding="utf-8")

    # Never grant privileges to anon or authenticated roles
    assert not re.search(r"GRANT\s+[^;]*\b(anon|authenticated)\b", sql_text, re.IGNORECASE)

    # Every CREATE POLICY statement must explicitly include TO service_role, USING, and WITH CHECK
    policies = re.findall(r"CREATE\s+POLICY\b[\s\S]*?;", sql_text, re.IGNORECASE)
    assert policies, f"No policies found in {sql_rel_path}"
    for stmt in policies:
        assert re.search(r"\bTO\s+service_role\b", stmt, re.IGNORECASE), f"Missing TO service_role: {stmt}"
        assert re.search(r"\bUSING\s*\(", stmt, re.IGNORECASE), f"Missing USING clause: {stmt}"
        assert re.search(r"\bWITH\s+CHECK\s*\(", stmt, re.IGNORECASE), f"Missing WITH CHECK clause: {stmt}"


def test_certifi_upgraded_and_tls_bundle_compatible():
    parts = [int(p) for p in certifi.__version__.split(".")[:3]]
    assert tuple(parts) >= (2026, 11, 20), f"Expected certifi >= 2026.11.20, found {certifi.__version__}"

    ca_path = Path(certifi.where())
    assert ca_path.is_file()

    ctx = ssl.create_default_context(cafile=str(ca_path))
    assert ctx is not None

    with httpx.Client(verify=ctx) as hx:
        assert hx is not None

    sess = requests.Session()
    sess.verify = str(ca_path)
    transport_req = google.auth.transport.requests.Request(session=sess)
    assert transport_req is not None


def test_gitignore_excludes_sensitive_files():
    gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
    for pattern in (".env", ".env.*", ".google_tokens.json", "docs/backup/", "*.pem", "*.key"):
        assert pattern in gitignore
