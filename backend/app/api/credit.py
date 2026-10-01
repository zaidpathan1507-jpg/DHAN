from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.services.credit_service import get_credit_readiness

router = APIRouter(prefix="/credit-readiness", tags=["credit"])


@router.get("")
def credit_readiness(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_credit_readiness(db, current_user.business_id)
