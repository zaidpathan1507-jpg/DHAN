from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Transaction, TransactionSource, User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
)
from app.services.categorize_service import categorize
from app.services.insights_service import flag_anomaly_for_new_transaction
from app.services.ocr_service import OCRUnavailable, extract_bill_fields

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListOut)
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: str | None = None,
    category: str | None = None,
    type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 200,
    offset: int = 0,
):
    query = db.query(Transaction).filter(Transaction.business_id == current_user.business_id)
    if q:
        query = query.filter(Transaction.vendor.ilike(f"%{q}%"))
    if category:
        query = query.filter(Transaction.category == category)
    if type:
        query = query.filter(Transaction.type == type)
    if date_from:
        query = query.filter(Transaction.txn_date >= date_from)
    if date_to:
        query = query.filter(Transaction.txn_date <= date_to)

    total = query.count()
    items = query.order_by(desc(Transaction.txn_date), desc(Transaction.id)).offset(offset).limit(limit).all()
    return TransactionListOut(total=total, items=items)


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat_method, cat_confidence = categorize(payload.vendor, payload.category)

    txn = Transaction(
        business_id=current_user.business_id,
        type=payload.type,
        amount=payload.amount,
        vendor=payload.vendor,
        category=payload.category,
        txn_date=payload.txn_date,
        payment_mode=payload.payment_mode,
        description=payload.description,
        gstin=payload.gstin,
        source=TransactionSource.LIVE,
        category_method=cat_method,
        category_confidence=cat_confidence,
    )
    db.add(txn)
    db.flush()

    txn.is_anomaly = flag_anomaly_for_new_transaction(db, current_user.business_id, txn)

    db.commit()
    db.refresh(txn)
    return txn


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(txn_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.business_id == current_user.business_id
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.patch("/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.business_id == current_user.business_id
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(txn, key, value)

    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(txn_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.business_id == current_user.business_id
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()


@router.post("/ocr")
async def ocr_bill(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    try:
        image_bytes = await file.read()
        result = extract_bill_fields(image_bytes)
        return result
    except OCRUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
