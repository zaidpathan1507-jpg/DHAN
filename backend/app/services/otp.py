"""One-time passcodes for passwordless login and optional two-step login.

Codes are 6 digits, valid 5 minutes, hashed at rest, limited to 5 guesses and 5 requests per hour per phone.
Delivery goes through the WhatsApp sender. With no WhatsApp provider configured the sender is simulated, so the
API returns the code for the on-screen "simulated phone" (demo mode); once real keys exist it never does.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from pymongo.database import Database

from app.core.config import get_settings
from app.services import messaging

TTL = timedelta(minutes=5)
MAX_GUESSES = 5
MAX_REQUESTS_PER_HOUR = 5


def _hash(phone: str, code: str) -> str:
    return hmac.new(get_settings().jwt_secret.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def demo_mode() -> bool:
    s = get_settings()
    return not (s.whatsapp_token and s.whatsapp_phone_id)


def issue(db: Database, phone: str) -> dict:
    now = datetime.now(timezone.utc)
    doc = db.otps.find_one({"phone": phone}) or {}
    recent = [t for t in doc.get("requests", []) if now - t.replace(tzinfo=timezone.utc) < timedelta(hours=1)]
    if len(recent) >= MAX_REQUESTS_PER_HOUR:
        return {"error": "rate_limited"}
    code = f"{secrets.randbelow(10**6):06d}"
    db.otps.update_one({"phone": phone}, {"$set": {"hash": _hash(phone, code), "expires": now + TTL, "guesses": 0, "requests": recent + [now]}}, upsert=True)
    res = messaging.send_whatsapp(phone, f"Your DHAN login code is {code}. It is valid for 5 minutes. Do not share it with anyone.")
    return {"sent": True, "status": res["status"], "demo_code": code if demo_mode() else None}


def verify(db: Database, phone: str, code: str) -> bool:
    doc = db.otps.find_one({"phone": phone})
    if not doc or doc.get("guesses", 0) >= MAX_GUESSES or doc["expires"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return False
    db.otps.update_one({"phone": phone}, {"$inc": {"guesses": 1}})
    if not hmac.compare_digest(doc["hash"], _hash(phone, code.strip())):
        return False
    db.otps.delete_one({"phone": phone})
    return True
