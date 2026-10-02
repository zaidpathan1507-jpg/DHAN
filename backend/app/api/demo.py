from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services.demo_seed_service import reset_demo_data, seed_demo_data

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
def seed(db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    count = seed_demo_data(db, current_user.business_id)
    return {"seeded": count}


@router.post("/reset")
def reset(db: Database = Depends(get_db), current_user = Depends(get_current_user)):
    reset_demo_data(db, current_user.business_id)
    return {"status": "reset"}
