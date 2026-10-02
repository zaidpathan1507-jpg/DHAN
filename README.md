# DHAN: Know your money. Grow your business.

An AI finance desk for small Indian businesses: expense tracking, udhaar (credit) collection, cash-crunch warnings, GST, and a Credit Passport that unlocks loans. Built for Hack2Ignite 2026, PS ID FT-05.

**One line:** small businesses run on udhaar and WhatsApp, so they discover a cash crunch only after it hits. DHAN sees it coming, helps fix it, and proves the business is creditworthy.

## Stack

- **Backend:** FastAPI, PyMongo / MongoDB (mongomock for tests), JWT auth, bcrypt, pydantic v2, Server-Sent Events, a background scheduler
- **Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, Recharts, Framer Motion
- **AI:** Groq (Llama 3.3 70B tool-calling, Whisper speech-to-text, Llama 4 Scout vision). A rules engine answers when no key is set.

## Features

### Money tracking
- **Dashboard:** cash in hand, 30-day outlook, income / expense / net with period comparison, spending mix, top vendors, alerts, a daily brief from DHAN AI, and a "Money waiting for you" card.
- **Transactions:** manual entry, filters, detail drawer, CSV export.
- **Voice entry** in English, Hindi and Marathi. Uses Groq Whisper when a key is set, the browser's speech recognition otherwise. The form is pre-filled for review; nothing saves without confirmation.
- **Bill scanning:** Google Vision OCR (optional) or Groq vision, with manual-entry fallback.
- **Bank-statement import:** upload a CSV, review guessed categories, import. Duplicates are skipped, so re-importing is safe. Sample: `frontend/public/sample-bank-statement.csv`.

### Udhaar (receivables and payables)
- Aging buckets, partial payments, late fees, settling an item records the cash movement.
- A customer pay page per receivable (`/pay/<token>`): UPI QR, "I've paid", "I'll pay on...", message.
- Live status for the owner (notification bell over SSE): opens, promises, payment claims.
- Auto-reminder ladder (before due, due, +3, +7, +15 days) with firmer tone, by email and WhatsApp.
- Per-customer reliability score and suggested credit limit.
- A **"Recovered by DHAN"** counter for money collected after a reminder.
- Email and WhatsApp run in **simulation** until keys are added. Razorpay payment links and webhook switch on with keys.

### DHAN AI
- **Ask DHAN AI** (`/ask`): ask about your books in English, Hindi, Marathi or Hinglish, by typing or voice, and hear answers read aloud. Answers show real tables and charts plus a "how I got this" trace. All numbers come from database tools, never from model text.
- **Agent with approval:** for a cash crunch it proposes actions (send reminders, delay a bill, turn on auto-remind) with the lowest-cash impact before and after. Nothing runs until the owner taps Approve; each approval is logged.
- **Cash Calendar** (`/cash-calendar`): day-by-day cash projection with a safety buffer, dated crunch warnings, a stress test and a rescue plan.
- **Forecast** with a what-if simulator (sales %, cost %, one-time cash) and an explained method.
- **Insights** and alerts from your own data.

### WhatsApp bot (simulated)
`/bot`: a phone-style chat. Send an entry by text, a voice note or a bill photo, ask questions, `UNDO`, `HELP`. Entries auto-save with undo; bill photos are drafted and confirmed first. The same bot answers on a real number once WhatsApp keys are added.

### Funding
- **Credit Readiness:** an indicative, rule-based score (explicitly not CIBIL).
- **Credit Passport:** a revocable, expiring link/QR a lender can open without logging in. Aggregates only, never individual transactions.
- **Funding marketplace** (`/loans`): offers from five **fictional** lenders matched to your numbers, live EMI, apply in a tap, an application tracker, and a public lender desk (`/lender/<token>`) where a lender approves, counters or declines. Demo only; no money moves.

### Compliance and reporting
- **GST helper** (`/gst`): output GST, input tax credit by category, filing dates (GSTR-1, GSTR-3B), invoices missing a GSTIN, and a CSV pack for your CA.
- **Weekly report** (`/reports`): written by DHAN AI, print-friendly, emailed every Monday if enabled.

### Security and trust
- Optional **OTP two-step login**, login lockout after repeated failures.
- **Read-only accountant role:** invite your CA; they see everything and can change nothing. Enforced in one place on the backend.
- **Activity log** of who did what and when.

### Languages and design
English, Hindi and Marathi. Marathi covers the main screens; missing keys fall back to Hindi, then English. Mobile-first layout with a bottom nav, accessible controls, and a design checked with the Impeccable detector.

## Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Edit `backend/.env`:
- `MONGODB_URI` (and optionally `MONGODB_DB`) is required.
- `GROQ_API_KEY` turns on the LLM, Whisper voice and bill-photo reading. Restart after changing `.env`.
- `GOOGLE_VISION_API_KEY` is an optional OCR key.
- `SMTP_*`, `WHATSAPP_*`, `RAZORPAY_*` are optional; leave blank to simulate.
- `APP_BASE_URL` is the frontend URL used in payment links.

API runs at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` and proxies `/api` to the backend.

### First run

1. Register a business account, or log in to the demo company (below).
2. **Settings > Load demo data** seeds about 180 days of history. Dashboard, Insights, Forecast and Credit Readiness need it to show real results.
3. Add a live transaction to see the dashboard update without a reload.

### Demo company: Gowurk

```bash
cd backend
python -m scripts.seed_gowurk
```

Seeds a home-services startup with transactions, receivables, a Credit Passport, an approved loan application, an accountant and an activity log.

| Role | Phone | Password |
|---|---|---|
| Owner | 7410534319 | 12345678 |
| Accountant (read-only) | 9000000042 | 12345678 |

## Checks

- Backend (from `backend/`): `python scripts/smoke_v3.py`, `smoke_ai.py`, `smoke_udhaar.py` (all use mongomock). `python scripts/check_groq.py` tests a real Groq key.
- Frontend: `node frontend/src/lib/voiceParser.test.mjs`, `node frontend/src/lib/statementParser.test.mjs`.

## Project layout

```
backend/app/api        routers: auth, transactions, dashboard, insights, forecast, credit,
                       receivables, udhaar_public, cash_calendar, ai, bot, loans, passport,
                       gst, reports, team, notifications, demo
backend/app/services   business logic, Groq / Razorpay / messaging adapters, scheduler
backend/scripts        demo seed and smoke tests
frontend/src/pages     one file per screen
frontend/src/lib       API client, i18n dictionaries, voice, parsers
docs/PITCH.md          pitch kit: one-liner, demo script, business model, architecture
```

## Notes

- Every number in the UI is computed from the database; nothing is hard-coded.
- Seeded data is tagged `DEMO DATA`; anything you add is tagged `LIVE`.
- Lenders are fictional, email and WhatsApp are simulated without keys, and the credit score is indicative only.
- Not built yet: deployment, PWA / offline mode, more languages (Tamil, Gujarati, etc.), budgets.

## Run as one app (one link)

The backend serves the built frontend, so a single process and a single URL runs everything.

```bash
npm run install:all   # once
npm run prod          # builds the frontend, then serves app + API on http://localhost:8000
```

Dev mode with hot reload: `npm run dev:api` in one terminal and `npm run dev:web` in another.

Deploying on Render: see the `Dockerfile` and `render.yaml` at the repo root (the step-by-step guide is in `docs/DEPLOY.md`).
