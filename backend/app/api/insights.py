from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services.insights_service import generate_insights

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("")
def list_insights(db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    return generate_insights(db, current_user.business_id)
