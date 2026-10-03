"""Customer portal: a customer signs in with their phone and sees what they owe to every shop that has them on udhaar.

Their dues are matched by a VERIFIED phone number (see /auth/customer/register). They can pay, retry a failed payment,
promise a date, message the shop or dispute an invoice. Everything lands on the same receivable timeline the owner
sees, so owner and customer always look at one source of truth.

Payments run in a SANDBOX: with no payment-gateway keys the customer picks a test outcome (like Razorpay's test mode),
so the failed-payment journey can be demonstrated. The success path books the money exactly like a real webhook would.
"""

import re
import secrets
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.db.session import day, get_business, oid
from app.services import udhaar_service as u

router = APIRouter(prefix="/customer", tags=["customer"])

CUSTOMER_EVENTS = {"sent", "msg", "payment", "pay_failed", "promise", "dispute", "dispute_resolved", "claim", "claim_confirmed", "claim_rejected", "settled", "created"}
FEED_EVENTS = {"sent", "msg", "payment", "claim_confirmed", "claim_rejected", "dispute_resolved"}


def get_customer(user=Depends(get_current_user)):
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer accounts only.")
    return user


class Pay(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    method: Literal["upi", "card", "netbanking"] = "upi"
    test: Literal["success", "insufficient_funds", "bank_down", "declined", "cancelled"] = "success"


class PromiseIn(BaseModel):
    date: date
    note: str | None = Field(default=None, max_length=200)


class Message(BaseModel):
    text: str = Field(min_length=1, max_length=400)


class Dispute(BaseModel):
    reason: Literal["wrong_amount", "not_received", "already_paid", "other"]
    text: str | None = Field(default=None, max_length=400)


def _mine(db: Database, phone: str) -> list[dict]:
    """Receivables addressed to this phone, matched on the last 10 digits whatever the formatting.
    ponytail: a regex scan; store an indexed `phone_key` on each receivable if one shop list ever gets large."""
    digits = re.sub(r"\D", "", phone)[-10:]
    if len(digits) < 10:
        return []
    pattern = r"\D*".join(digits) + r"\D*$"
    return list(db.receivables.find({"kind": "receivable", "phone": {"$regex": pattern}}))


def _get(db: Database, user, item_id: str) -> dict:
    _id = oid(item_id)
    doc = next((d for d in _mine(db, user.phone) if d["_id"] == _id), None) if _id else None
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return doc


def _party(doc: dict) -> str:
    return doc["party"].split(" – ")[0]


def _view(db: Database, doc: dict, today: date, detail: bool = False) -> dict:
    biz = vars(get_business(db, doc["business_id"]))
    evs = doc.get("events", [])
    failures = [e for e in evs if e["type"] == "pay_failed"]
    last_pay = max((e["at"] for e in evs if e["type"] == "payment"), default=None)
    recent_fail = failures[-1] if failures and (not last_pay or failures[-1]["at"] > last_pay) else None
    out = {
        "id": str(doc["_id"]), "shop": {"id": doc["business_id"], "name": biz["name"], "city": biz["city"]}, "note": doc.get("note"), "amount": doc["amount"],
        "paid_amount": u.paid_of(doc), "outstanding": u.outstanding_of(doc), "due_date": u.due_of(doc), "days_overdue": u.days_overdue(doc, today),
        "late_fee": u.late_fee_of(doc, today), "paid": doc["paid"], "promise_date": doc["promise_date"].date() if doc.get("promise_date") else None,
        "disputed": bool(doc.get("disputed")), "claim": bool(doc.get("claim")),
        "failed": {"reason": recent_fail["params"].get("reason"), "amount": recent_fail["params"].get("amount"), "at": recent_fail["at"], "count": len(failures)} if recent_fail else None,
    }
    if detail:
        out["upi_id"] = biz.get("upi_id")
        out["timeline"] = [{"type": e["type"], "at": e["at"], "params": {k: v for k, v in e["params"].items() if k not in ("status", "provider")}} for e in evs if e["type"] in CUSTOMER_EVENTS]
        out["sandbox"] = True
    return out


@router.get("/overview")
def overview(db: Database = Depends(get_db), user=Depends(get_customer)):
    today = date.today()
    docs = _mine(db, user.phone)
    shops: dict[str, dict] = {}
    for d in docs:
        v = _view(db, d, today)
        s = shops.setdefault(d["business_id"], {"shop": v["shop"], "outstanding": 0.0, "overdue": 0.0, "open": [], "settled": []})
        (s["settled"] if v["paid"] else s["open"]).append(v)
        if not v["paid"]:
            s["outstanding"] += v["outstanding"]
            if v["days_overdue"]:
                s["overdue"] += v["outstanding"]
    feed = []
    for d in docs:
        shop = get_business(db, d["business_id"]).name
        for e in d.get("events", []):
            if e["type"] in FEED_EVENTS and not (e["type"] == "msg" and e["params"].get("sender") != "owner"):
                feed.append({"type": e["type"], "at": e["at"], "invoice_id": str(d["_id"]), "shop": shop, "params": {k: v for k, v in e["params"].items() if k in ("text", "amount", "mode", "channel", "step")}})
    feed.sort(key=lambda x: x["at"], reverse=True)
    for s in shops.values():
        s["outstanding"], s["overdue"] = round(s["outstanding"], 2), round(s["overdue"], 2)
        s["open"].sort(key=lambda v: v["due_date"])
        s["settled"] = s["settled"][:5]
    totals = {"outstanding": round(sum(s["outstanding"] for s in shops.values()), 2), "overdue": round(sum(s["overdue"] for s in shops.values()), 2),
              "open": sum(len(s["open"]) for s in shops.values()), "failed": sum(1 for s in shops.values() for v in s["open"] if v["failed"])}
    return {"name": user.name, "phone": user.phone, "totals": totals, "shops": sorted(shops.values(), key=lambda s: -s["overdue"]), "activity": feed[:15]}


@router.get("/invoices/{item_id}")
def invoice(item_id: str, db: Database = Depends(get_db), user=Depends(get_customer)):
    return _view(db, _get(db, user, item_id), date.today(), detail=True)


@router.post("/invoices/{item_id}/pay")
def pay(item_id: str, payload: Pay, db: Database = Depends(get_db), user=Depends(get_customer)):
    doc = _get(db, user, item_id)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="This invoice is already paid.")
    owed = u.outstanding_of(doc)
    amount = round(min(payload.amount or owed, owed), 2)
    if payload.test != "success":
        u.log_event(db, doc["_id"], "pay_failed", reason=payload.test, amount=amount, method=payload.method)
        u.notify(db, doc["business_id"], "pay_failed", doc["_id"], party=_party(doc), amount=amount, reason=payload.test)
        return {"status": "failed", "reason": payload.test, "amount": amount, "outstanding": owed}
    after = u.apply_payment(db, doc, amount, {"upi": "UPI", "card": "Card", "netbanking": "Bank Transfer"}[payload.method], "customer")
    u.notify(db, doc["business_id"], "payment_auto", doc["_id"], party=_party(doc), amount=amount)
    return {"status": "paid", "amount": amount, "receipt": "DHN" + secrets.token_hex(4).upper(), "outstanding": u.outstanding_of(after), "settled": after["paid"]}


@router.post("/invoices/{item_id}/promise")
def promise(item_id: str, payload: PromiseIn, db: Database = Depends(get_db), user=Depends(get_customer)):
    doc = _get(db, user, item_id)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="Already paid")
    if payload.date < date.today() or payload.date > date.today() + timedelta(days=90):
        raise HTTPException(status_code=422, detail="Pick a date within the next 90 days")
    db.receivables.update_one({"_id": doc["_id"]}, {"$set": {"promise_date": day(payload.date)}})
    u.log_event(db, doc["_id"], "promise", date=payload.date.isoformat(), note=payload.note)
    u.notify(db, doc["business_id"], "promise", doc["_id"], party=_party(doc), date=payload.date.isoformat(), amount=u.outstanding_of(doc))
    return {"status": "ok"}


@router.post("/invoices/{item_id}/message")
def message(item_id: str, payload: Message, db: Database = Depends(get_db), user=Depends(get_customer)):
    doc = _get(db, user, item_id)
    u.log_event(db, doc["_id"], "msg", sender="customer", text=payload.text)
    u.notify(db, doc["business_id"], "msg", doc["_id"], party=_party(doc), text=payload.text)
    return {"status": "ok"}


@router.post("/invoices/{item_id}/dispute")
def dispute(item_id: str, payload: Dispute, db: Database = Depends(get_db), user=Depends(get_customer)):
    """'This isn't right.' Pauses automatic reminders until the owner replies and resolves it."""
    doc = _get(db, user, item_id)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="Already paid")
    db.receivables.update_one({"_id": doc["_id"]}, {"$set": {"disputed": True}})
    u.log_event(db, doc["_id"], "dispute", reason=payload.reason, text=payload.text)
    u.notify(db, doc["business_id"], "dispute", doc["_id"], party=_party(doc), reason=payload.reason, text=payload.text)
    return {"status": "ok"}
