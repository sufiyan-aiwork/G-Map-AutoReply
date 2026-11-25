# Techzone Academy - Customer Review Reply Automation System

A production-ready Customer Review Reply Automation System for **Techzone Academy**. This application automatically collects customer reviews from Techzone Academy's Google Business Profile, identifies their star rating, selects a predefined reply based on strict deterministic classification rules, and publishes the reply to Google while storing full records and audit trails in Supabase.

---

## 1. Business Logic & Classification Rules

The application uses **exactly two** predefined reply templates stored in Supabase:

### **Classification Rule**
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
│   │   ├── main.py                     # FastAPI application setup, CORS, /health
│   │   ├── config.py                   # Pydantic BaseSettings & environment config
│   │   │
│   │   ├── api/
│   │   │   ├── reviews.py              # Review listing, details, and simulation
│   │   │   ├── replies.py              # Template retrieval and update endpoints
│   │   │   ├── dashboard.py            # Summary statistics and distribution
│   │   │   ├── settings.py             # Automation pause/resume, polling & logs
│   │   │   └── auth.py                 # Google OAuth connection status
│   │   │
│   │   ├── services/
│   │   │   ├── rating_service.py       # Strict star classification logic (3-5 pos, 1-2 neg)
│   │   │   ├── reply_service.py        # Template selection and editing
│   │   │   ├── review_service.py       # Ingestion and duplicate detection
│   │   │   ├── publishing_service.py   # Reply publishing and pause enforcement
│   │   │   └── scheduler_service.py    # Automation state and polling configuration
│   │   │
│   │   ├── integrations/
│   │   │   ├── supabase_client.py      # Dual-mode Supabase REST + local sample store
│   │   │   └── google_business.py      # Google Business Profile API client (Phase 2)
│   │   │
│   │   └── models/
│   │       ├── review.py               # Pydantic schemas for reviews
│   │       └── reply.py                # Pydantic schemas for templates & published replies
│   │
│   ├── tests/
│   │   ├── test_rating_service.py      # Unit tests for 1-5 star classification
│   │   ├── test_reply_templates.py     # Unit tests for template rules & editing
│   │   └── test_api.py                 # Integration tests for all REST endpoints
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx              # Top bar with quick pause/resume toggle
│   │   │   ├── Sidebar.jsx             # Navigation sidebar with Techzone branding
│   │   │   ├── StatCard.jsx            # KPI metric cards
│   │   │   ├── StarRating.jsx          # Interactive & display star ratings
│   │   │   └── StatusBadge.jsx         # Status pill indicators
│   │   │
│   │   ├── pages/
│   │   │   ├── Overview.jsx            # 6 KPI cards, star chart, recent reviews & simulator
│   │   │   ├── Reviews.jsx             # Filterable reviews table & modal details
│   │   │   ├── Templates.jsx           # Two-template editor, active toggle & live preview
│   │   │   ├── Analytics.jsx           # Star distribution & positive/negative ratio
│   │   │   ├── Automation.jsx          # Pause/Resume controls & polling interval config
│   │   │   ├── ActivityLogs.jsx        # Audit trail of review and publishing events
│   │   │   └── GoogleSettings.jsx      # Google Business Profile connection info
│   │   │
│   │   ├── layouts/
│   │   │   └── DashboardLayout.jsx
│   │   ├── services/
│   │   │   └── api.js                  # Frontend REST API client
│   │   ├── App.jsx                     # State management and view routing
│   │   ├── main.jsx                    # React entrypoint
│   │   └── index.css                   # Tailwind styles
│   │
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env.example
│   └── .env
│
├── docs/
│   └── supabase_schema.sql             # Complete Supabase PostgreSQL schema with RLS & seed
│
├── .gitignore
└── README.md
```

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
