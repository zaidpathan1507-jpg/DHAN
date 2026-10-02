from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services.forecast_service import get_forecast, simulate

router = APIRouter(prefix="/forecast", tags=["forecast"])


class SimulateRequest(BaseModel):
    sales_pct: float = Field(0, ge=-100, le=500)
    cost_pct: float = Field(0, ge=-100, le=500)
    one_time: float = 0


@router.get("")
def forecast(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return get_forecast(db, current_user.business_id)


@router.post("/simulate")
def forecast_simulate(payload: SimulateRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return simulate(db, current_user.business_id, payload.sales_pct, payload.cost_pct, payload.one_time)
