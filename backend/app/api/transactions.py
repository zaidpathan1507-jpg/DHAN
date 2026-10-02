import re
from datetime import date, datetime, timezone
from enum import Enum
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pymongo import DESCENDING
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.db.models import TransactionSource
from app.db.session import day, oid, to_obj
from app.services import audit
from app.schemas.transaction import (
    ImportRequest,
    TransactionCreate,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
)
from app.services.categorize_service import categorize
from app.services.insights_service import flag_anomaly_for_new_transaction
from app.services.ocr_service import OCRUnavailable, extract_bill_fields

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_mongo(value):
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, date):
        return day(value)
    return value


def _get_or_404(db: Database, txn_id: str, business_id: str) -> dict:
    _id = oid(txn_id)
    doc = db.transactions.find_one({"_id": _id, "business_id": business_id}) if _id else None
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return doc


@router.get("", response_model=TransactionListOut)
def list_transactions(
    db: Database = Depends(get_db),
    current_user=Depends(get_current_user),
    q: str | None = None,
    category: str | None = None,
    type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 200,
    offset: int = 0,
):
    flt: dict = {"business_id": current_user.business_id}
    if q:
        flt["vendor"] = {"$regex": re.escape(q), "$options": "i"}
    if category:
        flt["category"] = category
    if type:
        flt["type"] = type
    if date_from or date_to:
        flt["txn_date"] = {}
        if date_from:
            flt["txn_date"]["$gte"] = day(date_from)
        if date_to:
            flt["txn_date"]["$lte"] = day(date_to)

    total = db.transactions.count_documents(flt)
    docs = db.transactions.find(flt).sort([("txn_date", DESCENDING), ("_id", DESCENDING)]).skip(offset).limit(limit)
    return TransactionListOut(total=total, items=[to_obj(d) for d in docs])


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Database = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cat_method, cat_confidence = categorize(payload.vendor, payload.category)

    doc = {
        "business_id": current_user.business_id,
        "type": payload.type.value,
        "amount": payload.amount,
        "vendor": payload.vendor,
        "category": payload.category,
        "txn_date": day(payload.txn_date),
        "payment_mode": payload.payment_mode,
        "description": payload.description,
        "gstin": payload.gstin,
        "source": TransactionSource.LIVE.value,
        "category_method": cat_method,
        "category_confidence": cat_confidence,
        "created_at": datetime.now(timezone.utc),
    }
    doc["is_anomaly"] = flag_anomaly_for_new_transaction(db, current_user.business_id, SimpleNamespace(**doc))
    doc["_id"] = db.transactions.insert_one(doc).inserted_id
    audit.log(db, current_user, "transaction.create", vendor=payload.vendor, amount=payload.amount, type=payload.type.value)
    return to_obj(doc)


@router.post("/import")
def import_transactions(payload: ImportRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    """Bulk-add rows parsed from a bank statement. Rows already on the books (same date, amount, vendor, type) are skipped."""
    bid, now, docs, skipped = current_user.business_id, datetime.now(timezone.utc), [], 0
    seen = set()
    if payload.rows:
        earliest = day(min(r.txn_date for r in payload.rows))
        seen = {
            (d["txn_date"].date(), d["amount"], d["vendor"].lower(), d["type"])
            for d in db.transactions.find({"business_id": bid, "txn_date": {"$gte": earliest}})
        }
    for r in payload.rows:
        key = (r.txn_date, r.amount, r.vendor.lower(), r.type.value)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        docs.append({
            "business_id": bid, "type": r.type.value, "amount": r.amount, "vendor": r.vendor, "category": r.category,
            "txn_date": day(r.txn_date), "payment_mode": r.payment_mode, "description": r.description, "gstin": None,
            "source": TransactionSource.LIVE.value, "is_anomaly": False, "category_method": "IMPORT",
            "category_confidence": None, "created_at": now,
        })
    if docs:
        db.transactions.insert_many(docs)
    audit.log(db, current_user, "transaction.import", imported=len(docs), skipped=skipped)
    return {"imported": len(docs), "skipped": skipped}


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(txn_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return to_obj(_get_or_404(db, txn_id, current_user.business_id))


@router.patch("/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: str,
    payload: TransactionUpdate,
    db: Database = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = _get_or_404(db, txn_id, current_user.business_id)

    changes = {k: _to_mongo(v) for k, v in payload.model_dump(exclude_unset=True).items()}
    if changes:
        db.transactions.update_one({"_id": doc["_id"]}, {"$set": changes})
        doc.update(changes)
    return to_obj(doc)


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(txn_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, txn_id, current_user.business_id)
    db.transactions.delete_one({"_id": doc["_id"]})
    audit.log(db, current_user, "transaction.delete", vendor=doc["vendor"], amount=doc["amount"])


@router.post("/ocr")
async def ocr_bill(
    file: UploadFile,
    current_user=Depends(get_current_user),
):
    try:
        image_bytes = await file.read()
        result = extract_bill_fields(image_bytes)
        return result
    except OCRUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
