from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services import advisor_service

router = APIRouter(prefix="/advisor", tags=["advisor"])


@router.get("")
def advice(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return advisor_service.analyze(db, current_user.business_id)


@router.get("/note")
async def note(lang: Literal["en", "hi", "mr"] = "en", db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return await run_in_threadpool(advisor_service.note, db, current_user.business_id, lang)
