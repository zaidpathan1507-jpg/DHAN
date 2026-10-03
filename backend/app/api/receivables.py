"""Receivables / payables ("udhaar") for the owner: entries, sending links, payments, claims, customers.

Each receivable gets a public pay link (see udhaar_public.py). Everything that happens on it lands on the entry's
timeline and in the owner's notifications.
"""

from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.db.session import day, get_business, oid
from app.services import audit, razorpay_service, udhaar_service as u

router = APIRouter(prefix="/receivables", tags=["receivables"])


class ReceivableCreate(BaseModel):
    kind: Literal["receivable", "payable"]
    party: str = Field(min_length=1, max_length=120)
    phone: str | None = None
    email: str | None = Field(default=None, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    amount: float = Field(gt=0)
    due_date: date
    note: str | None = None
    lang: Literal["en", "hi", "mr"] = "en"
    late_fee_pct: float = Field(0, ge=0, le=10)  # % of the outstanding amount per 30 days overdue
    auto_remind: bool = True


class SendRequest(BaseModel):
    channels: list[Literal["email", "whatsapp"]] = Field(min_length=1)
    step: Literal["first", "pre", "due", "late3", "late7", "final"] = "first"
    lang: Literal["en", "hi", "mr"] | None = None


class PaymentRequest(BaseModel):
    amount: float = Field(gt=0)
    mode: str = "UPI"


class ClaimResolve(BaseModel):
    accept: bool


class UpdateRequest(BaseModel):
    due_date: date | None = None
    note: str | None = None
    auto_remind: bool | None = None
    late_fee_pct: float | None = Field(default=None, ge=0, le=10)
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str | None = None


def _get_or_404(db: Database, item_id: str, business_id: str) -> dict:
    _id = oid(item_id)
    doc = db.receivables.find_one({"_id": _id, "business_id": business_id}) if _id else None
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return doc


@router.get("")
def list_items(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    docs = list(db.receivables.find({"business_id": current_user.business_id}).sort("due_date", 1))
    for d in docs:  # entries created before pay links existed get one on first read
        if "token" not in d:
            d["token"] = u.new_token()
            db.receivables.update_one({"_id": d["_id"]}, {"$set": {"token": d["token"]}})
    items = [u.serialize(d, today) for d in docs]
    open_items = [i for i in items if not i["paid"]]

    def summary(kind: str) -> dict:
        rows = [i for i in open_items if i["kind"] == kind]
        buckets = {"current": 0.0, "d1_30": 0.0, "d31_60": 0.0, "d61_plus": 0.0}
        for i in rows:
            o = i["days_overdue"]
            buckets["current" if o == 0 else "d1_30" if o <= 30 else "d31_60" if o <= 60 else "d61_plus"] += i["outstanding"]
        return {
            "total": round(sum(i["outstanding"] for i in rows), 2),
            "count": len(rows),
            "overdue": round(sum(i["outstanding"] for i in rows if i["days_overdue"]), 2),
            "aging": buckets,
        }

    return {
        "items": items,
        "receivable": summary("receivable"),
        "payable": summary("payable"),
        "claims_waiting": sum(1 for i in open_items if i["claim"]),
        "recovered": u.recovered([d for d in docs if d["kind"] == "receivable"]),
        "integrations": {  # tells the UI which channels are real vs simulated
            "email": "live" if _smtp() else "simulated",
            "whatsapp": "live" if _wa() else "simulated",
            "razorpay": razorpay_service.enabled(),
        },
    }


def _smtp() -> bool:
    from app.core.config import get_settings

    return bool(get_settings().smtp_host)


def _wa() -> bool:
    from app.core.config import get_settings

    s = get_settings()
    return bool(s.whatsapp_token and s.whatsapp_phone_id)


@router.get("/customers")
def customer_ledger(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return u.customers(db, current_user.business_id)


@router.post("", status_code=201)
def create_item(payload: ReceivableCreate, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = {
        "business_id": current_user.business_id,
        **payload.model_dump(exclude={"due_date"}),
        "due_date": day(payload.due_date),
        "token": u.new_token(),
        "paid": False,
        "payments": [],
        "events": [],
        "steps_sent": [],
        "created_at": u.now(),
    }
    doc["_id"] = db.receivables.insert_one(doc).inserted_id
    u.log_event(db, doc["_id"], "created")
    audit.log(db, current_user, "udhaar.create", party=payload.party, amount=payload.amount, kind=payload.kind)
    return u.serialize(db.receivables.find_one({"_id": doc["_id"]}), date.today())


@router.patch("/{item_id}")
def update_item(item_id: str, payload: UpdateRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, item_id, current_user.business_id)
    changes = payload.model_dump(exclude_unset=True)
    if "due_date" in changes and changes["due_date"]:
        changes["due_date"] = day(changes["due_date"])
    if changes:
        db.receivables.update_one({"_id": doc["_id"]}, {"$set": changes})
    return u.serialize(db.receivables.find_one({"_id": doc["_id"]}), date.today())


@router.post("/{item_id}/send")
def send_item(item_id: str, payload: SendRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, item_id, current_user.business_id)
    if doc["kind"] != "receivable" or doc["paid"]:
        raise HTTPException(status_code=409, detail="Nothing to send for this entry")
    business = vars(get_business(db, current_user.business_id))
    if razorpay_service.enabled() and not doc.get("razorpay_url"):
        rp = razorpay_service.create_payment_link(
            amount=u.outstanding_of(doc), description=f"{business['name']} – {doc.get('note') or 'payment request'}", party=doc["party"],
            phone=doc.get("phone"), email=doc.get("email"), reference=str(doc["_id"]), callback_url=u.link_of(doc),
        )
        if rp:
            db.receivables.update_one({"_id": doc["_id"]}, {"$set": {"razorpay_url": rp["short_url"], "razorpay_link_id": rp["id"]}})
            doc = db.receivables.find_one({"_id": doc["_id"]})
    results = u.dispatch(db, doc, business, payload.channels, payload.step, payload.lang or doc.get("lang", "en"))
    if not results:
        raise HTTPException(status_code=422, detail="No contact on file for the selected channels")
    audit.log(db, current_user, "udhaar.send", party=doc["party"], channels=[r["channel"] for r in results], step=payload.step)
    return {"results": results, "link": u.link_of(doc)}


@router.get("/{item_id}/preview")
def preview_message(item_id: str, step: Literal["first", "pre", "due", "late3", "late7", "final"] = "first", lang: Literal["en", "hi", "mr"] = "en",
                    db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    """The exact text a send would use, so the UI never duplicates the templates."""
    doc = _get_or_404(db, item_id, current_user.business_id)
    subject, body = u.render_message(doc, get_business(db, current_user.business_id).name, step, lang, date.today())
    return {"subject": subject, "body": body}


@router.get("/{item_id}/messages")
def item_messages(item_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, item_id, current_user.business_id)
    viewed = next((e["at"] for e in doc.get("events", []) if e["type"] == "viewed"), None)
    out = []
    for m in db.outbox.find({"receivable_id": str(doc["_id"])}).sort("created_at", 1):
        created = m["created_at"]
        out.append({
            "channel": m["channel"], "to": m["to"], "subject": m["subject"], "body": m["body"], "step": m["step"], "status": m["status"],
            "provider": m["provider"], "created_at": created,
            # tick state for the simulated phone: sent -> delivered after ~2s -> read once the customer opened the link
            "delivered": (u.now() - created.replace(tzinfo=timezone.utc)).total_seconds() > 2,
            "read": bool(viewed and viewed.replace(tzinfo=timezone.utc) >= created.replace(tzinfo=timezone.utc)),
        })
    return out


@router.post("/{item_id}/payment")
def record_payment(item_id: str, payload: PaymentRequest, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, item_id, current_user.business_id)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="Already settled")
    audit.log(db, current_user, "udhaar.payment", party=doc["party"], amount=payload.amount)
    return u.serialize(u.apply_payment(db, doc, payload.amount, payload.mode, "owner"), date.today())


@router.post("/{item_id}/settle")
def settle_item(item_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, item_id, current_user.business_id)
    if doc["paid"]:
        raise HTTPException(status_code=409, detail="Already settled")
    u.apply_payment(db, doc, u.outstanding_of(doc), "Bank Transfer", "owner")
    audit.log(db, current_user, "udhaar.settle", party=doc["party"])
    return {"status": "settled"}


@router.post("/{item_id}/claim")
def resolve_claim(item_id: str, payload: ClaimResolve, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    """Owner confirms (books the payment) or rejects the customer's 'I've paid' claim."""
    doc = _get_or_404(db, item_id, current_user.business_id)
    claim = doc.get("claim")
    if not claim:
        raise HTTPException(status_code=409, detail="No pending claim")
    if payload.accept:
        doc = u.apply_payment(db, doc, claim["amount"], claim.get("mode") or "UPI", "customer_claim")
        u.log_event(db, doc["_id"], "claim_confirmed", amount=claim["amount"])
        audit.log(db, current_user, "udhaar.claim_confirmed", party=doc["party"], amount=claim["amount"])
    else:
        db.receivables.update_one({"_id": doc["_id"]}, {"$unset": {"claim": ""}})
        u.log_event(db, doc["_id"], "claim_rejected", amount=claim["amount"])
        audit.log(db, current_user, "udhaar.claim_rejected", party=doc["party"])
        doc = db.receivables.find_one({"_id": doc["_id"]})
    return u.serialize(doc, date.today())


class Reply(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    resolve_dispute: bool = False


@router.post("/{item_id}/reply")
def reply_to_customer(item_id: str, payload: Reply, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    """A message to the customer; they read it in their portal. Replying can also close their dispute."""
    doc = _get_or_404(db, item_id, current_user.business_id)
    u.log_event(db, doc["_id"], "msg", sender="owner", text=payload.text)
    if payload.resolve_dispute and doc.get("disputed"):
        db.receivables.update_one({"_id": doc["_id"]}, {"$unset": {"disputed": ""}})
        u.log_event(db, doc["_id"], "dispute_resolved")
    audit.log(db, current_user, "udhaar.reply", party=doc["party"])
    return u.serialize(db.receivables.find_one({"_id": doc["_id"]}), date.today())


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    doc = _get_or_404(db, item_id, current_user.business_id)
    db.receivables.delete_one({"_id": doc["_id"]})
    audit.log(db, current_user, "udhaar.delete", party=doc["party"])
    db.outbox.delete_many({"receivable_id": str(doc["_id"])})
