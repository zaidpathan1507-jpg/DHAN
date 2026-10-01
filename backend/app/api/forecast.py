from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.services.forecast_service import get_forecast

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("")
def forecast(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_forecast(db, current_user.business_id)
