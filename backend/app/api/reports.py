from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services import audit, reports_service

router = APIRouter(prefix="/reports", tags=["reports"])


class EmailRequest(BaseModel):
    to: str | None = Field(default=None, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    lang: Literal["en", "hi", "mr"] = "en"


@router.get("/weekly")
async def weekly(lang: Literal["en", "hi", "mr"] = "en", db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return await run_in_threadpool(reports_service.weekly_report, db, current_user.business_id, lang)


@router.post("/weekly/email")
async def email_weekly(payload: EmailRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    to = payload.to or (db.users.find_one({"_id": __import__("bson").ObjectId(current_user.id)}) or {}).get("report_email")
    if not to:
        raise HTTPException(status_code=422, detail="Add an email address first.")
    out = await run_in_threadpool(reports_service.send_report, db, current_user.business_id, to, payload.lang)
    audit.log(db, current_user, "report.email", to=to, status=out["status"])
    return out
