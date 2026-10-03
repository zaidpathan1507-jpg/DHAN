"""What the customer sees: a login-free pay page per receivable, plus the Razorpay webhook.

The unguessable token in the URL is the only credential, same model as the Credit Passport. Customers can view
the request, promise a date, say they paid (the owner still confirms) or leave a note.
"""

import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_db
from app.db.session import day, get_business
from app.services import pay_service, razorpay_service, udhaar_service as u

public_router = APIRouter(prefix="/public/udhaar", tags=["udhaar-public"])
webhook_router = APIRouter(prefix="/webhooks", tags=["webhooks"])

VIEW_SESSION = timedelta(minutes=30)  # a reopen within this window is the same visit


class Promise(BaseModel):
    date: date
    note: str | None = Field(default=None, max_length=300)


class Claim(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    reference: str | None = Field(default=None, max_length=60)
    mode: str = "UPI"


class Note(BaseModel):
    text: str = Field(min_length=1, max_length=300)


def _doc(db: Database, token: str) -> dict:
    doc = db.receivables.find_one({"token": token, "kind": "receivable"})
    if not doc:
        raise HTTPException(status_code=404, detail="This payment link is not valid.")
    return doc


@public_router.get("/{token}")
def view(token: str, db: Database = Depends(get_db)):
    doc = _doc(db, token)
    business = vars(get_business(db, doc["business_id"]))
    today = date.today()

    last_view = next((e["at"] for e in reversed(doc.get("events", [])) if e["type"] == "viewed"), None)
    if not last_view or u.now() - last_view.replace(tzinfo=timezone.utc) > VIEW_SESSION:
        first = last_view is None
        u.log_event(db, doc["_id"], "viewed")
        if first:
            u.notify(db, doc["business_id"], "viewed", doc["_id"], party=doc["party"], amount=u.outstanding_of(doc))
        doc = db.receivables.find_one({"_id": doc["_id"]})

    return {
        "business": {"name": business["name"], "city": business["city"]},
        "party": doc["party"], "note": doc.get("note"), "amount": doc["amount"], "paid_amount": u.paid_of(doc),
        "outstanding": u.outstanding_of(doc), "due_date": u.due_of(doc), "days_overdue": u.days_overdue(doc, today),
        "late_fee": u.late_fee_of(doc, today), "paid": doc["paid"],
        "promise_date": doc["promise_date"].date() if doc.get("promise_date") else None,
        "claim": {"amount": doc["claim"]["amount"], "at": doc["claim"]["at"]} if doc.get("claim") else None,
        "razorpay": pay_service.mode(), "upi_link": u.upi_link(business, doc), "upi_id": business.get("upi_id"), "razorpay_url": doc.get("razorpay_url"),
        "payments": [{"amount": p["amount"], "at": p["at"]} for p in doc.get("payments", [])],
    }


class RzpOrder(BaseModel):
    amount: float | None = Field(default=None, gt=0)


class RzpVerify(BaseModel):
    razorpay_order_id: str = Field(max_length=60)
    razorpay_payment_id: str = Field(max_length=60)
    razorpay_signature: str = Field(max_length=200)


class RzpFailed(BaseModel):
    order_id: str | None = Field(default=None, max_length=60)
    reason: str = Field(default="declined", max_length=30)
    detail: str | None = Field(default=None, max_length=200)


def _pay(fn, *a):
    try:
        return fn(*a)
    except pay_service.PayError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)


@public_router.post("/{token}/rzp/order")
def rzp_order(token: str, payload: RzpOrder, db: Database = Depends(get_db)):
    return _pay(pay_service.create_order, db, _doc(db, token), payload.amount)


@public_router.post("/{token}/rzp/verify")
def rzp_verify(token: str, payload: RzpVerify, db: Database = Depends(get_db)):
    doc = _doc(db, token)
    return _pay(pay_service.verify, db, doc, payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, doc["party"].split(" – ")[0])


@public_router.post("/{token}/rzp/failed")
def rzp_failed(token: str, payload: RzpFailed, db: Database = Depends(get_db)):
    doc = _doc(db, token)
    return pay_service.failed(db, doc, payload.order_id, payload.reason, payload.detail, doc["party"].split(" – ")[0])


@public_router.post("/{token}/promise")
def promise(token: str, payload: Promise, db: Database = Depends(get_db)):
    doc = _doc(db, token)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="Already paid")
    if payload.date < date.today() or payload.date > date.today() + timedelta(days=90):
        raise HTTPException(status_code=422, detail="Pick a date within the next 90 days")
    db.receivables.update_one({"_id": doc["_id"]}, {"$set": {"promise_date": day(payload.date)}})
    u.log_event(db, doc["_id"], "promise", date=payload.date.isoformat(), note=payload.note)
    u.notify(db, doc["business_id"], "promise", doc["_id"], party=doc["party"], date=payload.date.isoformat(), amount=u.outstanding_of(doc))
    return {"status": "ok"}


@public_router.post("/{token}/claim")
def claim(token: str, payload: Claim, db: Database = Depends(get_db)):
    doc = _doc(db, token)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="Already paid")
    amount = min(payload.amount or u.outstanding_of(doc), u.outstanding_of(doc))
    db.receivables.update_one({"_id": doc["_id"]}, {"$set": {"claim": {"amount": amount, "reference": payload.reference, "mode": payload.mode, "at": u.now()}}})
    u.log_event(db, doc["_id"], "claim", amount=amount, reference=payload.reference)
    u.notify(db, doc["business_id"], "claim", doc["_id"], party=doc["party"], amount=amount, reference=payload.reference)
    return {"status": "ok"}


@public_router.post("/{token}/note")
def note(token: str, payload: Note, db: Database = Depends(get_db)):
    doc = _doc(db, token)
    u.log_event(db, doc["_id"], "note", text=payload.text)
    u.notify(db, doc["business_id"], "note", doc["_id"], party=doc["party"], text=payload.text)
    return {"status": "ok"}


@webhook_router.post("/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str | None = Header(default=None), db: Database = Depends(get_db)):
    body = await request.body()
    if not razorpay_service.verify_webhook(body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Bad signature")
    event = json.loads(body)
    if event.get("event") == "payment_link.paid":
        link_id = event["payload"]["payment_link"]["entity"]["id"]
        paise = event["payload"]["payment"]["entity"]["amount"]
        doc = db.receivables.find_one({"razorpay_link_id": link_id})
        if doc and not doc["paid"]:
            doc = u.apply_payment(db, doc, paise / 100, "UPI", "razorpay")
            u.notify(db, doc["business_id"], "payment_auto", doc["_id"], party=doc["party"], amount=paise / 100)
    return {"status": "ok"}
