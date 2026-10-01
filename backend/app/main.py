from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, credit, dashboard, demo, forecast, insights, transactions
from app.core.config import get_settings
from app.db import models  # noqa: F401 ensures models are registered
from app.db.session import Base, engine

settings = get_settings()

Base.metadata.create_all(bind=engine)

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


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
