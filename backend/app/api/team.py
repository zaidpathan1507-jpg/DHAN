"""Team access: the owner can add accountants who see everything but can change nothing, plus the activity log."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.deps import get_current_user, get_db, require_owner
from app.core.security import hash_password
from app.db.session import oid
from app.services import audit

router = APIRouter(tags=["team"])


class Invite(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=6, max_length=100)


def _out(u: dict) -> dict:
    return {"id": str(u["_id"]), "name": u["name"], "phone": u["phone"], "role": u.get("role", "owner"), "created_at": u["created_at"]}


@router.get("/team")
def list_team(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    return [_out(u) for u in db.users.find({"business_id": current_user.business_id}).sort("created_at", 1)]


@router.post("/team", status_code=201)
def add_accountant(payload: Invite, db: Database = Depends(get_db), current_user=Depends(require_owner)):
    try:
        res = db.users.insert_one({
            "name": payload.name.strip(), "phone": payload.phone.strip(), "password_hash": hash_password(payload.password),
            "business_id": current_user.business_id, "role": "accountant", "created_at": datetime.now(timezone.utc),
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="That phone number is already registered.")
    audit.log(db, current_user, "team.add", name=payload.name, role="accountant")
    return _out(db.users.find_one({"_id": res.inserted_id}))


@router.delete("/team/{user_id}", status_code=204)
def remove_member(user_id: str, db: Database = Depends(get_db), current_user=Depends(require_owner)):
    _id = oid(user_id)
    target = db.users.find_one({"_id": _id, "business_id": current_user.business_id}) if _id else None
    if not target or target.get("role", "owner") == "owner":
        raise HTTPException(status_code=404, detail="Member not found")
    db.users.delete_one({"_id": _id})
    audit.log(db, current_user, "team.remove", name=target["name"])


@router.get("/audit")
def activity_log(limit: int = 40, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    rows = db.audit.find({"business_id": current_user.business_id}).sort("at", -1).limit(max(1, min(limit, 200)))
    return [{"id": str(r["_id"]), "user": r["user_name"], "role": r["role"], "action": r["action"], "detail": r["detail"], "at": r["at"]} for r in rows]
