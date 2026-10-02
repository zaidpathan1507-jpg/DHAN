from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import ai, auth, bot, gst, loans, reports, team, cash_calendar, credit, dashboard, demo, forecast, insights, notifications, passport, receivables, transactions, udhaar_public
from app.core.config import get_settings
from app.db.session import database, ensure_indexes
from app.services import reminder_scheduler

settings = get_settings()

ensure_indexes()
if settings.reminders_enabled:
    reminder_scheduler.start(database)

app = FastAPI(title="DHAN API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(forecast.router, prefix="/api/v1")
app.include_router(credit.router, prefix="/api/v1")
app.include_router(demo.router, prefix="/api/v1")
app.include_router(passport.router, prefix="/api/v1")
app.include_router(passport.public_router, prefix="/api/v1")
app.include_router(receivables.router, prefix="/api/v1")
app.include_router(udhaar_public.public_router, prefix="/api/v1")
app.include_router(udhaar_public.webhook_router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(cash_calendar.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(bot.router, prefix="/api/v1")
app.include_router(loans.router, prefix="/api/v1")
app.include_router(gst.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(loans.public_router, prefix="/api/v1")
app.include_router(bot.voice_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


# One-link deploy: when the frontend has been built (frontend/dist), this server serves it too.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST in file.parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")  # client-side routes (/dashboard, /pay/<token>, ...)
