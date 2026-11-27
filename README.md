# TechZone Academy — Customer Review Reply Automation System

A production-oriented Customer Review Reply Automation System for **TechZone Academy**. The platform synchronizes customer reviews from TechZone Academy's Google Business Profile, classifies ratings using strict deterministic rules, selects the matching brand-approved reply template, verifies publication on Google Business Profile, and stores complete review and audit histories in Supabase PostgreSQL.

---

## 1. Business Logic & Classification Rules

The system enforces **strictly two** predefined reply templates stored in Supabase:

| Star Rating | Category | Template Applied |
| :--- | :--- | :--- |
| **5 Stars** | Positive | Positive Predefined Reply |
| **4 Stars** | Positive | Positive Predefined Reply |
| **3 Stars** | Positive | Positive Predefined Reply |
| **2 Stars** | Negative | Negative Predefined Reply |
| **1 Star** | Negative | Negative Predefined Reply |

### Default Templates

1. **Positive Reply (Ratings 3, 4, 5):**
   > *"Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!"*
2. **Negative Reply (Ratings 1, 2):**
   > *"We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services."*

- **Deterministic (No AI/LLM Generation):** Replies are never dynamically generated or paraphrased.
- **Template Activation Safety:** If a template is deactivated or missing, publishing halts cleanly and logs an alert in `system_logs`.
- **Duplicate & Manual Reply Protection:** Prevents duplicate publishing via composite key `(location_id, google_review_id)`, per-review async locking, `verification_pending` reconciliation, and pre-publish Google `GET` checks so existing manual owner replies are never overwritten.

---

## 2. Technology Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS 3, Lucide React
- **Backend:** Python 3.14+, FastAPI, Pydantic v2 / pydantic-settings, Uvicorn, HTTPX, `cryptography` (AES-256-GCM)
- **Database:** Supabase (PostgreSQL via PostgREST with `service_role`-only RLS policies & `updated_at` triggers)
- **External API:** Google Business Profile API (`https://www.googleapis.com/auth/business.manage`) & OAuth 2.0
- **Testing & Verification:** Pytest (`pytest-asyncio`, HTTPX ASGI client), Vite production build

---

## 3. Project Structure

```text
Review_reply_agent/
│
├── backend/
│   ├── app/
│   │   ├── main.py                        # FastAPI entrypoint, security headers, payload cap, CORS, /health
│   │   ├── config.py                      # Environment settings (Supabase, Google OAuth, Auth, Timezone, Proxy IPs)
│   │   │
│   │   ├── api/
│   │   │   ├── admin_auth.py              # Cookie login/logout, /me, CSRF, Origin checks, trusted-proxy IP
│   │   │   ├── auth.py                    # Google OAuth 2.0 status, URL, callback, disconnect
│   │   │   ├── dashboard.py               # /api/dashboard/summary with timezone-aware All Time & 7/14/21/30d filters
│   │   │   ├── replies.py                 # Template retrieval and update endpoints
│   │   │   ├── reviews.py                 # Review listing/filtering, preview, controlled single publish, simulator
│   │   │   └── settings.py                # DB status, automation pause/resume, polling settings, activity logs
│   │   │
│   │   ├── services/
│   │   │   ├── admin_auth_service.py      # Scrypt auth, JWT sessions, CSRF tokens, bounded rate limiting, OAuth state
│   │   │   ├── publishing_service.py      # Controlled publish, pre-publish Google GET checks, verification & retries
│   │   │   ├── rating_service.py          # Strict 1-5 star classification (3-5 positive, 1-2 negative)
│   │   │   ├── reply_service.py           # Template lookup, validation, and updates
│   │   │   ├── review_service.py          # Review ingestion, dry-run simulation, and Google sync reconciliation
│   │   │   └── scheduler_service.py       # Background polling loop with immediate pause/interval wakeup
│   │   │
│   │   ├── integrations/
│   │   │   ├── google_business.py         # Google Business Profile API client & AES-256-GCM encrypted token store
│   │   │   └── supabase_client.py         # Service-role Supabase PostgREST client + isolated in-memory test store
│   │   │
│   │   └── models/
│   │       ├── admin.py                   # Admin login, user, and session/CSRF response schemas
│   │       ├── reply.py                   # Reply template update & published reply schemas
│   │       └── review.py                  # Review, simulation request, and response schemas
│   │
│   ├── tests/
│   │   ├── test_admin_auth.py             # Auth cookies, scrypt, rate limits, CSRF, logout revocation, CORS
│   │   ├── test_api.py                    # API integration, date-range filters, TZ boundaries, controlled publishing
│   │   ├── test_google_integration.py     # OAuth flow, account/location discovery, sync pipeline, star parsing
│   │   ├── test_rating_service.py         # Unit tests for 1-5 star rating classification
│   │   ├── test_reply_templates.py        # Template selection, inactive protection, editing
│   │   ├── test_scheduler_automation.py   # Scheduler cycles, pause/resume, concurrency locks, historical safety
│   │   ├── test_security_phase1.py        # Service-role key enforcement, SQL RLS checks, certifi, .gitignore
│   │   ├── test_security_phase2.py        # AES-256-GCM tokens, XFF/rate-limit caps, CSRF, publishing safety, 413 cap
│   │   └── test_synchronization_fixes.py  # verification_pending mapping, GET-only reconciliation, wakeup events
│   │
│   ├── bootstrap_admin.py                 # CLI utility to create/update admin accounts or generate scrypt hashes
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── techzone_logo.png              # Official TechZone Academy logo asset
│   ├── src/
│   │   ├── components/
│   │   │   ├── BrandLogo.jsx              # Logo renderer with typographic fallback
│   │   │   ├── ConfirmDialog.jsx          # Portaled confirmation dialog for critical actions
│   │   │   ├── Navbar.jsx                 # Sync button, global Auto-Reply Pause/Resume, refresh, profile menu
│   │   │   ├── SelectMenu.jsx             # Accessible animated custom dropdown menu
│   │   │   ├── Sidebar.jsx                # Primary 5-item workspace navigation & live automation status footer
│   │   │   ├── SkeletonLoader.jsx         # KPI, card, and table loading skeletons
│   │   │   ├── StarRating.jsx             # Display and interactive 1-5 star rating component
│   │   │   ├── StatCard.jsx               # Interactive KPI summary card with drilldown support
│   │   │   └── StatusBadge.jsx            # Published / Verification Pending / Pending / Paused / Failed pills
│   │   ├── layouts/
│   │   │   └── DashboardLayout.jsx        # Responsive dashboard shell (sidebar + navbar + scroll container)
│   │   ├── pages/
│   │   │   ├── Login.jsx                  # Admin login screen with session notice & Caps Lock indicator
│   │   │   ├── Overview.jsx               # All Time & Last 7/14/21/30 Days filter, 6 KPIs, breakdown, simulator, feed
│   │   │   ├── Reviews.jsx                # Responsive review table/cards, filters, pagination, inspection modal
│   │   │   ├── Templates.jsx              # Positive/Negative template editors, activation switches & live preview
│   │   │   ├── ActivityLogs.jsx           # Searchable audit log table, 10s auto-refresh, portaled log detail modal
│   │   │   ├── Settings.jsx               # Unified Google Business Profile OAuth controls & polling cadence settings
│   │   │   ├── Analytics.jsx              # Legacy analytics view (retained in source; superseded by Overview)
│   │   │   ├── Automation.jsx             # Legacy automation page (consolidated into Settings.jsx)
│   │   │   └── GoogleSettings.jsx         # Legacy Google settings page (consolidated into Settings.jsx)
│   │   ├── services/
│   │   │   └── api.js                     # Credentialed fetch client attaching X-CSRF-Token on unsafe methods
│   │   ├── utils/
│   │   │   └── dateUtils.js               # Safe timestamp parsing/formatting & timezone calendar-day utilities
│   │   ├── App.jsx                        # Auth gate, polling refresh orchestration, period state & view routing
│   │   ├── index.css                      # Tailwind directives, dropdown/modal/toast animations & custom scrollbars
│   │   └── main.jsx                       # React 18 StrictMode entrypoint
│   │
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
│
├── docs/
│   ├── supabase_schema.sql                  # Core schema (reviews, reply_templates, published_replies, business_config, system_logs)
│   ├── admin_auth_migration.sql             # Administrator credentials table (admin_users)
│   ├── security_rls_migration.sql           # Phase 1 RLS & service_role privilege hardening
│   └── auth_session_persistence_migration.sql # Phase 2 persistent JWT revocation & OAuth state tables
│
├── .gitignore
└── README.md
```

---

## 4. Setup & Running Instructions

### A. Supabase Database & Migrations

1. Open your [Supabase Dashboard](https://supabase.com) → **SQL Editor**.
2. Execute the SQL scripts in order:
   1. `docs/supabase_schema.sql` — creates `reviews`, `reply_templates`, `published_replies`, `business_config`, and `system_logs` with triggers and seed templates.
   2. `docs/admin_auth_migration.sql` — creates `admin_users` (restricted to `service_role`).
   3. `docs/security_rls_migration.sql` — revokes `anon`/`authenticated` privileges and enforces `service_role`-only RLS policies across all application tables.
   4. `docs/auth_session_persistence_migration.sql` — creates `admin_revoked_tokens` and `oauth_states` (`service_role` only) for restart-safe logout revocation and single-use OAuth states.

*(Without Supabase credentials configured, the backend falls back to an isolated in-memory sample store for local offline development.)*

### B. Backend Environment & Admin Bootstrap

1. Copy `backend/.env.example` to `backend/.env` and configure required values:
   ```env
   ENVIRONMENT=development
   TIMEZONE=Asia/Kolkata
   FRONTEND_URL=http://localhost:5173

   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_KEY=your-anon-or-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key

   GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   GOOGLE_TOKEN_ENCRYPTION_KEY=<32-byte-base64-key>

   ADMIN_AUTH_SECRET=<strong-random-secret-at-least-32-chars>
   AUTO_REPLY_ENABLED=false
   ```
   - Generate `GOOGLE_TOKEN_ENCRYPTION_KEY`:
     `python -c "import base64, secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"`
   - Generate `ADMIN_AUTH_SECRET`:
     `python -c "import secrets; print(secrets.token_urlsafe(48))"`
2. Install Python dependencies and create an administrator account:
   ```bash
   cd backend
   pip install -r requirements.txt
   python bootstrap_admin.py
   ```
3. Start the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   - Health check: `http://localhost:8000/health`
   - Swagger UI (development only; disabled when `ENVIRONMENT=production`): `http://localhost:8000/docs`

### C. Frontend Execution

1. Configure `frontend/.env` from `frontend/.env.example`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
2. Install packages and start Vite (`http://localhost:5173`):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

---

## 5. Dashboard Features

- **Overview:** Default **All Time** view plus compact date-range selector (**Last 7 / 14 / 21 / 30 Days**, filtered on `review_created_at` in configured `TIMEZONE`), 6 KPI cards with drilldown navigation, Star Rating Breakdown, dry-run Interactive Review Simulator, and Recent Reviews feed.
- **Customer Reviews:** Filterable by category, star rating, status, and search query; responsive table & mobile cards; viewport-centered inspection modal with live template preview and controlled single-review publishing.
- **Reply Templates:** Edit, preview, copy, restore defaults, and toggle active state for Positive and Negative templates while preserving unsaved edits across background polling.
- **Activity Logs:** Filterable audit trail by status and event type, optional 10-second auto-refresh, and viewport-centered log detail modal.
- **Settings:** Combined Google Business Profile OAuth 2.0 connection/discovery controls and review polling interval configuration (`5`, `15`, `30`, or `60` minutes).

---

## 6. Security Controls

- **Admin Authentication & Sessions:** Scrypt password hashing, HMAC-SHA256 JWT tokens in `HttpOnly`, `SameSite=Lax` cookies (`Secure` enabled when `ENVIRONMENT=production`), persistent logout revocation (`admin_revoked_tokens`), and startup validation failing closed if `ADMIN_AUTH_SECRET` is weak/missing in production.
- **CSRF & Origin Protection:** Session-bound `X-CSRF-Token` validation and `Origin`/`Referer` verification on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Rate Limiting & Proxy Trust:** Per-IP, per-IP+username, and global per-username login throttling with bounded in-memory key eviction; `X-Forwarded-For` trusted only for configured `TRUSTED_PROXY_IPS`.
- **OAuth & Token Encryption:** Single-use signed OAuth state nonces (`oauth_states`) and AES-256-GCM encryption for stored Google tokens in `.google_tokens.json` with atomic writes and restricted file permissions.
- **Supabase & HTTP Hardening:** Backend uses `SUPABASE_SERVICE_ROLE_KEY` exclusively with `anon`/`authenticated` PostgREST access blocked by RLS/privileges; PostgREST filter parameter encoding; security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store`, `Strict-Transport-Security` in prod); and request body limit enforcement (`413`).

---

## 7. Automated Testing & Builds

Run the full backend Pytest suite (**103 tests** across 9 test files):
```bash
cd backend
python -m pytest -v
```

Verify the frontend production bundle:
```bash
cd frontend
npm run build
```
