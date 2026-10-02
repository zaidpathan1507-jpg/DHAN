from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services import ai_actions, dhan_ai

router = APIRouter(prefix="/ai", tags=["dhan-ai"])


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1500)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    lang: Literal["en", "hi", "mr"] = "en"


@router.get("/status")
def status(current_user=Depends(get_current_user)):
    return dhan_ai.mode()


@router.post("/ask")
async def ask(payload: AskRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    if dhan_ai.rate_limited(current_user.id):
        raise HTTPException(status_code=429, detail="Too many questions. Try again in a minute.")
    # LLM calls can take seconds; keep the event loop free.
    return await run_in_threadpool(dhan_ai.ask, db, current_user.business_id, payload.question, [t.model_dump() for t in payload.history], payload.lang)


@router.get("/actions")
def list_actions(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    rows = db.ai_actions.find({"business_id": current_user.business_id, "status": "pending"}).sort("created_at", -1)
    return [ai_actions.serialize(a) for a in rows]


class ApproveAll(BaseModel):
    ids: list[str] = Field(max_length=20)


@router.post("/actions/approve-all")
def approve_all(payload: ApproveAll, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return [ai_actions.execute(db, current_user, i) for i in payload.ids]


@router.post("/actions/{action_id}/approve")
def approve_action(action_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    out = ai_actions.execute(db, current_user, action_id)
    if out.get("error"):
        raise HTTPException(status_code=404 if out["error"] == "not-found" else 409, detail="That action is no longer available.")
    return out


@router.post("/actions/{action_id}/skip")
def skip_action(action_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    out = ai_actions.skip(db, current_user, action_id)
    if out.get("error"):
        raise HTTPException(status_code=409, detail="That action is no longer available.")
    return out


@router.get("/brief")
async def brief(lang: Literal["en", "hi", "mr"] = "en", db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return await run_in_threadpool(dhan_ai.brief, db, current_user.business_id, lang)
