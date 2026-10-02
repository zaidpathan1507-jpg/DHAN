"""Credit Passport: a revocable, expiring, read-only link the owner can hand to a lender.

The public view exposes only the aggregates below (score, 90-day totals, forecast status), never raw
transactions, and every link is a consent record the owner can revoke.
"""

import hashlib
import hmac
import json
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.config import get_settings
from app.core.deps import get_current_user, get_db
from app.db.models import TransactionType
from app.db.session import day, find_txns, get_business, oid, to_obj
from app.services import audit
from app.services.credit_service import get_credit_readiness
from app.services.forecast_service import get_forecast

router = APIRouter(prefix="/passport", tags=["passport"])
public_router = APIRouter(prefix="/public/passport", tags=["passport"])


class PassportCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)  # who it is for, e.g. "HDFC Bank, Baner branch"
    valid_days: int = Field(7, ge=1, le=90)


def _out(doc) -> dict:
    p = to_obj(doc)
    return {
        "id": p.id, "token": p.token, "label": p.label, "created_at": p.created_at, "expires_at": p.expires_at,
        "revoked": p.revoked, "views": p.views,
    }


@router.get("")
def list_passports(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    docs = db.passports.find({"business_id": current_user.business_id}).sort("created_at", -1)
    return [_out(d) for d in docs]


@router.post("")
def create_passport(payload: PassportCreate, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "business_id": current_user.business_id, "token": secrets.token_urlsafe(12), "label": payload.label.strip(),
        "created_at": now, "expires_at": now + timedelta(days=payload.valid_days), "revoked": False, "views": 0,
    }
    doc["_id"] = db.passports.insert_one(doc).inserted_id
    audit.log(db, current_user, "passport.create", label=doc["label"], days=payload.valid_days)
    return _out(doc)


@router.delete("/{passport_id}")
def revoke_passport(passport_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    _id = oid(passport_id)
    res = db.passports.update_one({"_id": _id, "business_id": current_user.business_id}, {"$set": {"revoked": True}}) if _id else None
    if not res or not res.matched_count:
        raise HTTPException(status_code=404, detail="Passport not found")
    audit.log(db, current_user, "passport.revoke")
    return {"status": "revoked"}


def snapshot(db: Database, business_id: str) -> dict:
    """The aggregates a lender may see (never raw transactions)."""
    business = get_business(db, business_id)
    credit = get_credit_readiness(db, business_id)
    forecast = get_forecast(db, business_id)
    today = date.today()
    recent = find_txns(db, {"business_id": business_id, "txn_date": {"$gt": day(today - timedelta(days=90)), "$lte": day(today)}})
    income = sum(float(t.amount) for t in recent if t.type == TransactionType.income)
    expenses = sum(float(t.amount) for t in recent if t.type == TransactionType.expense)
    first = db.transactions.find_one({"business_id": business_id}, sort=[("txn_date", 1)])
    return {
        "business": {"name": business.name, "type": business.business_type, "city": business.city},
        "credit": credit,
        "last_90_days": {
            "income": round(income), "expenses": round(expenses), "net": round(income - expenses),
            "avg_monthly_income": round(income / 3), "transactions": len(recent),
        },
        "months_of_records": round((today - first["txn_date"].date()).days / 30.4, 1) if first else 0,
        "forecast_status": None if forecast.get("insufficient_history") else forecast["status"],
    }


def passport_body(db: Database, p: dict) -> dict:
    now = datetime.now(timezone.utc)
    body = {**snapshot(db, p["business_id"]), "prepared_for": p["label"], "generated_at": now.isoformat(timespec="seconds"), "valid_until": p["expires_at"].isoformat(timespec="seconds")}
    # Integrity code: lets the owner (or DHAN) later confirm this exact snapshot was issued by DHAN.
    secret = get_settings().jwt_secret.encode()
    body["integrity_code"] = hmac.new(secret, json.dumps(body, sort_keys=True, default=str).encode(), hashlib.sha256).hexdigest()[:16].upper()
    return body


@public_router.get("/{token}")
def view_passport(token: str, db: Database = Depends(get_db)):
    p = db.passports.find_one({"token": token})
    if not p or p["revoked"]:
        raise HTTPException(status_code=404, detail="This passport link is not valid.")
    if p["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This passport link has expired.")
    db.passports.update_one({"_id": p["_id"]}, {"$inc": {"views": 1}})
    return passport_body(db, p)
