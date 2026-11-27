# TechZone Academy — Customer Review Reply Automation System

A production-ready Customer Review Reply Automation System for **Techzone Academy**. This application automatically collects customer reviews from Techzone Academy's Google Business Profile, identifies their star rating, selects a predefined reply based on strict deterministic classification rules, and publishes the reply to Google while storing full records and audit trails in Supabase.

---

## 1. Business Logic & Classification Rules

The application uses **exactly two** predefined reply templates stored in Supabase:

| Star Rating | Category | Template Applied |
| :--- | :--- | :--- |
| **5 Stars** | Positive | Positive Predefined Reply |
| **4 Stars** | Positive | Positive Predefined Reply |
| **3 Stars** | Positive | Positive Predefined Reply |
| **2 Stars** | Negative | Negative Predefined Reply |
| **1 Star**  | Negative | Negative Predefined Reply |

### **Initial Predefined Templates**
1. **Positive Reply (Ratings 3, 4, 5):**
   > *"Thank you for sharing your valuable feedback with Techzone Academy! We are happy to have you as part of our learning community. We truly appreciate your support!"*
2. **Negative Reply (Ratings 1, 2):**
   > *"We sincerely apologise that your experience did not meet your expectations. Thank you for sharing your feedback with us. We value your suggestions and will continue working to improve our services."*

- **No AI generation:** Replies are never generated dynamically with LLMs or sentiment models.
- **Strict two templates:** Only Positive and Negative templates exist.
- **Administrator control:** Templates can be edited, previewed, and toggled active/inactive via the React dashboard.
- **Safety guarantee:** If a template is inactive or missing, the system halts publishing, flags an alert, and records the incident in `system_logs`.

---

## 2. Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React icons
- **Backend:** Python 3.14+, FastAPI, Pydantic v2, Uvicorn, HTTPX
- **Database:** Supabase (PostgreSQL with Row Level Security & Triggers)
- **Google Integration:** Google Business Profile API & Google OAuth 2.0 (Phase 2 readiness)
- **Testing:** Pytest, pytest-asyncio, HTTPX

---

## 3. Project Structure

```
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


---

## 4. Setup & Running Instructions

### **A. Supabase Database Setup**
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor**.
3. Copy and run the script in `docs/supabase_schema.sql`.
4. This creates the 5 required tables (`reviews`, `reply_templates`, `published_replies`, `business_config`, `system_logs`), sets up unique constraints to prevent duplicates, applies triggers for `updated_at`, and seeds the initial Positive and Negative templates.
5. In your Supabase Project Settings $\rightarrow$ API, copy your `Project URL` and `anon` / `service_role` key.
6. Paste them into `backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-key
   ```
*(Note: If left blank during local development, the backend automatically uses an in-memory sample store so you can develop and test immediately!)*

---

### **B. Backend Execution**
1. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```
2. Start the FastAPI development server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
3. Verify in your browser:
   - Health check: [http://localhost:8000/health](http://localhost:8000/health)
   - Interactive Swagger API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### **C. Frontend Execution**
1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite React development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### **D. Running Automated Tests**
Run the comprehensive Pytest test suite:
```bash
cd backend
python -m pytest tests -v
```
**30 tests** cover:
- Star classification for 5, 4, 3, 2, 1 stars and validation of invalid values.
- Exactly two predefined reply templates and selection logic.
- Inactive template protection (publishing blocked).
- Live template editing and update persistence.
- REST API endpoints (`/health`, `/api/dashboard/summary`, `/api/reviews`, `/api/replies/templates`, `/api/automation/pause`, `/api/automation/resume`).
- Google OAuth 2.0 URL generation and `business.manage` scope validation.
- Google star rating parser (`FIVE`, `FOUR`, `THREE`, `TWO`, `ONE` to integer ratings).
- Google reviews synchronization pipeline and duplicate skipping.
- Immediate manual review sync endpoint (`POST /api/reviews/sync-now`).
- Token exchange and Google disconnect endpoint.

---

## 5. Phase 1 & 2 Features Verified

- [x] **React.js Dashboard:** Modern SaaS UI with all 7 requested views.
- [x] **FastAPI REST Backend:** Modular architecture with CORS, health check, lifespan background scheduler, and error handlers.
- [x] **Supabase PostgreSQL Schema:** SQL script in `docs/supabase_schema.sql` with tables, indexes, constraints, and initial templates.
- [x] **Deterministic Rating Logic:** 3, 4, 5 stars $\rightarrow$ Positive Reply; 1, 2 stars $\rightarrow$ Negative Reply.
- [x] **Template Editor:** Ability to view, edit, preview, and toggle active status of both templates.
- [x] **Automation Controls:** Pause and resume auto-replies, configure polling intervals.
- [x] **Google Business Profile Integration (Phase 2):** OAuth 2.0 authorization, token exchange, account/location discovery, and reply publishing with bounded retries.
- [x] **Duplicate Prevention:** Enforces idempotency via `(location_id, google_review_id)` and skips reviews with existing replies.
- [x] **Audit Trail:** Activity logs record every review detection, template selection, sync run, and publishing event.
- [x] **Live Review Simulator & Sync Buttons:** Built into Overview, Google Settings, and top navigation for instant manual review synchronization.
