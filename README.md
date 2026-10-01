# DHAN — Know your money. Grow your business.

Digital expense tracking and financial analytics for MSMEs. Hack2Ignite 2026, PS ID FT-05.

## Stack

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, JWT auth
- **Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, Recharts, Framer Motion

## Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env` with your PostgreSQL connection string. To enable real bill-scanning OCR, set `GOOGLE_VISION_API_KEY` — without it, the Scan Bill flow gracefully falls back to manual entry.

```bash
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` and proxies `/api` to the backend.

### First run

1. Register a business account.
2. Go to **Settings → Load Demo Data** to seed ~180 days of realistic transaction history — Dashboard, Insights, Forecast and Credit Readiness all need enough history to show real (non-empty-state) results.
3. Add a live transaction (manual or Scan Bill) to see the dashboard update without a reload.

## Notes

- Every number shown in the UI is computed from the database — nothing is hard-coded.
- Seeded data is always tagged `DEMO DATA`; anything you add is tagged `LIVE`.
- Credit Readiness is an indicative, rule-based score — explicitly not a CIBIL score or lending decision.
- This build covers the MVP demo path: Login → Dashboard → Add Transaction (manual + OCR) → Insights → Forecast → Credit Readiness. Budgets, Reports, and full Settings are not yet implemented.
