import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services import gst_service

router = APIRouter(prefix="/gst", tags=["gst"])


@router.get("/summary")
def summary(months: int = Query(6, ge=1, le=12), rate: int = Query(18), inclusive: bool = True, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return gst_service.gst_summary(db, current_user.business_id, months, rate, inclusive)


@router.get("/register")
def register(month: str, rate: int = Query(18), inclusive: bool = True, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status_code=422, detail="month must look like 2026-09")
    return gst_service.register(db, current_user.business_id, month, rate, inclusive)
