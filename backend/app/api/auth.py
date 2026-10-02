import time
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.deps import get_current_user, get_db, require_owner
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_business, oid, to_obj
from app.schemas.auth import BusinessPaymentUpdate, LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import audit, otp

router = APIRouter(prefix="/auth", tags=["auth"])

_failures: dict[str, list[float]] = {}
MAX_FAILURES, WINDOW = 8, 600  # 8 wrong passwords per phone per 10 minutes


def _locked(phone: str) -> bool:
    now = time.time()
    _failures[phone] = [t for t in _failures.get(phone, []) if now - t < WINDOW]
    return len(_failures[phone]) >= MAX_FAILURES


class OtpRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)


class OtpVerify(OtpRequest):
    code: str = Field(min_length=4, max_length=8)


class SecurityUpdate(BaseModel):
    two_factor: bool


class ReportSettings(BaseModel):
    report_email: str | None = Field(default=None, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    weekly_report: bool = False


def _token(user_doc: dict) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(subject=str(user_doc["_id"])))


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Database = Depends(get_db)):
    conflict = HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")
    if db.users.find_one({"phone": payload.phone}):
        raise conflict

    now = datetime.now(timezone.utc)
    business_id = db.businesses.insert_one({
        "name": payload.business_name,
        "business_type": payload.business_type,
        "city": payload.city,
        "opening_balance": payload.opening_balance,
        "created_at": now,
    }).inserted_id

    try:
        user_id = db.users.insert_one({
            "name": payload.name,
            "phone": payload.phone,
            "password_hash": hash_password(payload.password),
            "business_id": str(business_id),
            "role": "owner",
            "created_at": now,
        }).inserted_id
    except DuplicateKeyError:  # lost a race on the unique phone index
        db.businesses.delete_one({"_id": business_id})
        raise conflict

    return TokenResponse(access_token=create_access_token(subject=str(user_id)))


@router.post("/login")
def login(payload: LoginRequest, db: Database = Depends(get_db)):
    if _locked(payload.phone):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Try again in a few minutes.")
    doc = db.users.find_one({"phone": payload.phone})
    if not doc or not verify_password(payload.password, doc["password_hash"]):
        _failures.setdefault(payload.phone, []).append(time.time())
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone or password")

    if doc.get("two_factor"):  # second step: a code to the phone
        res = otp.issue(db, payload.phone)
        if res.get("error"):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many codes requested. Try again later.")
        return {"otp_required": True, "phone": payload.phone, "demo_code": res["demo_code"]}

    audit.log(db, to_obj(doc), "auth.login")
    return _token(doc)


@router.post("/otp/request")
def otp_request(payload: OtpRequest, db: Database = Depends(get_db)):
    """Passwordless sign-in. The reply is identical whether or not the phone is registered."""
    if db.users.find_one({"phone": payload.phone}):
        res = otp.issue(db, payload.phone)
        if res.get("error"):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many codes requested. Try again later.")
        return {"sent": True, "demo_code": res["demo_code"]}
    return {"sent": True, "demo_code": None}


@router.post("/otp/verify", response_model=TokenResponse)
def otp_verify(payload: OtpVerify, db: Database = Depends(get_db)):
    doc = db.users.find_one({"phone": payload.phone})
    if not doc or not otp.verify(db, payload.phone, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="That code is wrong or has expired.")
    audit.log(db, to_obj(doc), "auth.otp_login")
    return _token(doc)


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user), db: Database = Depends(get_db)):
    doc = db.users.find_one({"_id": oid(current_user.id)})
    return {
        "id": current_user.id,
        "name": current_user.name,
        "phone": current_user.phone,
        "role": current_user.role,
        "two_factor": bool(doc.get("two_factor")),
        "report_email": doc.get("report_email"),
        "weekly_report": bool(doc.get("weekly_report")),
        "business": get_business(db, current_user.business_id),
    }


@router.patch("/business", response_model=UserOut)
def update_business_payment(payload: BusinessPaymentUpdate, current_user=Depends(require_owner), db: Database = Depends(get_db)):
    """Where customers pay (UPI ID shown on Udhaar pages as a QR / pay button)."""
    db.businesses.update_one({"_id": oid(current_user.business_id)}, {"$set": {"upi_id": payload.upi_id}})
    audit.log(db, current_user, "settings.upi", upi=payload.upi_id)
    return me(current_user, db)


@router.patch("/security", response_model=UserOut)
def update_security(payload: SecurityUpdate, current_user=Depends(require_owner), db: Database = Depends(get_db)):
    db.users.update_one({"_id": oid(current_user.id)}, {"$set": {"two_factor": payload.two_factor}})
    audit.log(db, current_user, "security.two_factor", enabled=payload.two_factor)
    return me(current_user, db)


@router.patch("/report-settings", response_model=UserOut)
def update_report_settings(payload: ReportSettings, current_user=Depends(require_owner), db: Database = Depends(get_db)):
    if payload.weekly_report and not payload.report_email:
        raise HTTPException(status_code=422, detail="Add an email address to receive the weekly report.")
    db.users.update_one({"_id": oid(current_user.id)}, {"$set": {"report_email": payload.report_email, "weekly_report": payload.weekly_report}})
    audit.log(db, current_user, "settings.weekly_report", enabled=payload.weekly_report)
    return me(current_user, db)
