from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.services.demo_seed_service import reset_demo_data, seed_demo_data

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/seed")
def seed(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = seed_demo_data(db, current_user.business_id)
    return {"seeded": count}


@router.post("/reset")
def reset(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reset_demo_data(db, current_user.business_id)
    return {"status": "reset"}
