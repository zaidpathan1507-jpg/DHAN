"""Loan marketplace endpoints (simulated lenders) + the lender-side desk a lender opens from the shared passport link."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.api.passport import passport_body
from app.core.deps import get_current_user, get_db
from app.db.session import oid
from app.services import audit, loans_service as ls, udhaar_service as u

router = APIRouter(prefix="/loans", tags=["loans"])
public_router = APIRouter(prefix="/public/lender", tags=["loans"])


class Apply(BaseModel):
    lender_id: str
    amount: int = Field(gt=0)
    tenure: int = Field(gt=0)


class Decision(BaseModel):
    decision: Literal["approve", "counter", "decline"]
    amount: int | None = Field(default=None, gt=0)
    rate: float | None = Field(default=None, ge=5, le=40)
    reason: str | None = Field(default=None, max_length=200)


@router.get("/offers")
def get_offers(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return ls.offers(db, current_user.business_id)


@router.get("/applications")
def list_applications(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    apps = [ls.progress(db, a) for a in db.loan_applications.find({"business_id": current_user.business_id}).sort("created_at", -1)]
    return [ls.serialize(a) for a in apps]


@router.post("/applications", status_code=201)
def apply(payload: Apply, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    lender = ls.lender_by_id(payload.lender_id)
    offer = next((o for o in ls.offers(db, current_user.business_id)["offers"] if o["id"] == payload.lender_id), None)
    if not lender or not offer:
        raise HTTPException(status_code=422, detail="You're not eligible for that lender yet.")
    if payload.amount > offer["amount"] or payload.tenure not in offer["tenures"]:
        raise HTTPException(status_code=422, detail="That amount or tenure isn't available.")
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(12)
    db.passports.insert_one({"business_id": current_user.business_id, "token": token, "label": f"{lender['name']} (loan application)", "created_at": now, "expires_at": now + timedelta(days=30), "revoked": False, "views": 0})
    doc = {
        "business_id": current_user.business_id, "lender_id": lender["id"], "lender_name": lender["name"], "product": lender["product"], "amount": payload.amount, "tenure": payload.tenure,
        "rate": offer["rate"], "fee_pct": offer["fee_pct"], "emi": ls.emi(payload.amount, offer["rate"], payload.tenure), "status": "submitted", "decision": None,
        "passport_token": token, "created_at": now, "events": [{"stage": "submitted", "at": now}],
    }
    doc["_id"] = db.loan_applications.insert_one(doc).inserted_id
    audit.log(db, current_user, "loan.apply", lender=lender["name"], amount=payload.amount)
    return ls.serialize(doc)


def _own(db: Database, app_id: str, bid: str) -> dict:
    _id = oid(app_id)
    app = db.loan_applications.find_one({"_id": _id, "business_id": bid}) if _id else None
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return ls.progress(db, app)


@router.post("/applications/{app_id}/accept")
def accept(app_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    app = _own(db, app_id, current_user.business_id)
    if app["status"] != "approved":
        raise HTTPException(status_code=409, detail="There's no offer to accept yet.")
    db.loan_applications.update_one({"_id": app["_id"]}, {"$set": {"status": "accepted"}, "$push": {"events": {"stage": "accepted", "at": datetime.now(timezone.utc)}}})
    audit.log(db, current_user, "loan.accept", lender=app["lender_name"])
    return ls.serialize(db.loan_applications.find_one({"_id": app["_id"]}))


@router.post("/applications/{app_id}/withdraw")
def withdraw(app_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    app = _own(db, app_id, current_user.business_id)
    if app["status"] in ("accepted", "withdrawn", "declined"):
        raise HTTPException(status_code=409, detail="This application is already closed.")
    db.loan_applications.update_one({"_id": app["_id"]}, {"$set": {"status": "withdrawn"}, "$push": {"events": {"stage": "withdrawn", "at": datetime.now(timezone.utc)}}})
    audit.log(db, current_user, "loan.withdraw", lender=app["lender_name"])
    return ls.serialize(db.loan_applications.find_one({"_id": app["_id"]}))


# ---------------------------------------------------------------- lender desk (public, token = the shared passport link)
def _by_token(db: Database, token: str) -> tuple[dict, dict]:
    pas = db.passports.find_one({"token": token})
    app = db.loan_applications.find_one({"passport_token": token})
    if not pas or pas["revoked"] or not app:
        raise HTTPException(status_code=404, detail="This lender link is not valid.")
    if pas["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This lender link has expired.")
    return pas, app


@public_router.get("/{token}")
def lender_view(token: str, db: Database = Depends(get_db)):
    pas, app = _by_token(db, token)
    if not any(e["stage"] == "lender_viewed" for e in app.get("events", [])):
        db.loan_applications.update_one({"_id": app["_id"]}, {"$push": {"events": {"stage": "lender_viewed", "at": datetime.now(timezone.utc)}}})
        u.notify(db, app["business_id"], "loan_viewed", "", lender=app["lender_name"], app_id=str(app["_id"]))
    app = ls.progress(db, db.loan_applications.find_one({"_id": app["_id"]}))
    return {"application": ls.serialize(app), "borrower": passport_body(db, pas)}


@public_router.post("/{token}/decision")
def lender_decide(token: str, payload: Decision, db: Database = Depends(get_db)):
    _, app = _by_token(db, token)
    if app["status"] in ("accepted", "withdrawn"):
        raise HTTPException(status_code=409, detail="The borrower has already closed this application.")
    now = datetime.now(timezone.utc)
    if payload.decision == "decline":
        decision, status = {"by": "lender", "reason": payload.reason or "Does not meet our current criteria."}, "declined"
        u.notify(db, app["business_id"], "loan_declined", "", lender=app["lender_name"], app_id=str(app["_id"]))
    else:
        amount = payload.amount if payload.decision == "counter" and payload.amount else app["amount"]
        rate = payload.rate if payload.decision == "counter" and payload.rate else app["rate"]
        decision, status = {"by": "lender", "amount": amount, "rate": rate, "tenure": app["tenure"]}, "approved"
        u.notify(db, app["business_id"], "loan_approved", "", lender=app["lender_name"], amount=amount, rate=rate, app_id=str(app["_id"]))
    db.loan_applications.update_one({"_id": app["_id"]}, {"$set": {"status": status, "decision": decision}, "$push": {"events": {"stage": status, "at": now}}})
    return ls.serialize(db.loan_applications.find_one({"_id": app["_id"]}))
