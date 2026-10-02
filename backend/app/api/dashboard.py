from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
def overview(period: str = "30d", db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    return dashboard_service.get_overview(db, current_user.business_id, period)


@router.get("/cashflow")
def cashflow(period: str = "30d", db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    return dashboard_service.get_cashflow_series(db, current_user.business_id, period)


@router.get("/spending-mix")
def spending_mix(period: str = "30d", db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    return dashboard_service.get_spending_mix(db, current_user.business_id, period)


@router.get("/top-vendors")
def top_vendors(period: str = "30d", db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    return dashboard_service.get_top_vendors(db, current_user.business_id, period)
