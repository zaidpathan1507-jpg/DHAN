"""Bank connection: link the (sandbox) bank, auto-sync its statement into the books, and a 'bank app' to move test money."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db, require_owner
from app.db.session import get_business
from app.services import audit, bank_service as bank

router = APIRouter(prefix="/bank", tags=["bank"])


class LinkRequest(BaseModel):
    bank: str


class LiveRequest(BaseModel):
    live: bool


class Simulate(BaseModel):
    kind: Literal["credit", "debit"]
    name: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0, le=10_000_000)
    mode: Literal["UPI", "NEFT", "IMPS", "CARD"] = "UPI"
    note: str | None = Field(default=None, max_length=60)


def _acc(db: Database, bid: str) -> dict:
    acc = db.bank_accounts.find_one({"business_id": bid})
    if not acc:
        raise HTTPException(status_code=404, detail="No bank account is linked yet.")
    return acc


@router.get("")
def status(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    acc = db.bank_accounts.find_one({"business_id": current_user.business_id})
    return {"banks": bank.catalog(), "account": bank.serialize(acc) if acc else None, "sandbox": True}


@router.post("/link", status_code=201)
def link(payload: LinkRequest, db: Database = Depends(get_db), current_user=Depends(require_owner)):
    if db.bank_accounts.find_one({"business_id": current_user.business_id}):
        raise HTTPException(status_code=409, detail="A bank account is already linked.")
    try:
        acc = bank.link(db, current_user.business_id, get_business(db, current_user.business_id).name, payload.bank)
    except ValueError:
        raise HTTPException(status_code=422, detail="Unknown bank")
    audit.log(db, current_user, "bank.link", bank=payload.bank)
    result = bank.sync(db, acc)  # first pull: the statement history lands straight away
    return {"account": bank.serialize(db.bank_accounts.find_one({"_id": acc["_id"]})), "sync": result}


@router.post("/sync")
def sync(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return bank.sync(db, _acc(db, current_user.business_id))


@router.post("/live")
def live(payload: LiveRequest, db: Database = Depends(get_db), current_user=Depends(require_owner)):
    acc = _acc(db, current_user.business_id)
    db.bank_accounts.update_one({"_id": acc["_id"]}, {"$set": {"live": payload.live}})
    return {"live": payload.live}


@router.post("/simulate")
def simulate(payload: Simulate, db: Database = Depends(get_db), current_user=Depends(require_owner)):
    """The bank-side action: a customer pays you, or you pay a vendor. The next sync (automatic) books it."""
    acc = _acc(db, current_user.business_id)
    line = bank.post_line(db, acc, payload.kind, payload.name, payload.amount, payload.mode, payload.note or "")
    return bank.serialize_line(line)


@router.get("/feed")
def feed(limit: int = 40, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    acc = _acc(db, current_user.business_id)
    rows = db.bank_ledger.find({"account_id": acc["_id"]}).sort([("date", -1), ("_id", -1)]).limit(max(1, min(limit, 200)))
    return {"items": [bank.serialize_line(l) for l in rows], "pending": db.bank_ledger.count_documents({"account_id": acc["_id"], "status": "pending"})}


@router.delete("", status_code=204)
def revoke(db: Database = Depends(get_db), current_user=Depends(require_owner)):
    """Withdraw consent. Transactions already imported stay on your books."""
    acc = _acc(db, current_user.business_id)
    db.bank_ledger.delete_many({"account_id": acc["_id"]})
    db.bank_accounts.delete_one({"_id": acc["_id"]})
    audit.log(db, current_user, "bank.revoke")
