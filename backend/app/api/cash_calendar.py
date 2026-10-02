from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services.cash_calendar import cash_calendar

router = APIRouter(prefix="/cash-calendar", tags=["cash-calendar"])


@router.get("")
def get_calendar(
    days: int = Query(45, ge=7, le=90),
    sales_pct: float = Query(0, ge=-100, le=300),
    cost_pct: float = Query(0, ge=-100, le=300),
    db: Database = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return cash_calendar(db, current_user.business_id, days, sales_pct, cost_pct)
