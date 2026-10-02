from datetime import date, datetime, time
from types import SimpleNamespace

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, MongoClient

from app.core.config import get_settings

settings = get_settings()

client = MongoClient(settings.mongodb_uri, tz_aware=True)
database = client[settings.mongodb_db]


def ensure_indexes() -> None:
    database.users.create_index("phone", unique=True)
    database.transactions.create_index([("business_id", ASCENDING), ("txn_date", ASCENDING)])
    database.passports.create_index("token", unique=True)
    database.receivables.create_index("business_id")
    database.receivables.create_index("token", unique=True, sparse=True)
    database.notifications.create_index([("business_id", ASCENDING), ("_id", ASCENDING)])
    database.outbox.create_index("receivable_id")
    database.audit.create_index([("business_id", ASCENDING), ("at", ASCENDING)])
    database.otps.create_index("phone", unique=True)
    database.loan_applications.create_index("passport_token", unique=True)
    database.ai_actions.create_index("business_id")
    database.bot_messages.create_index([("business_id", ASCENDING), ("at", ASCENDING)])


def oid(value) -> ObjectId | None:
    try:
        return ObjectId(str(value))
    except InvalidId:
        return None


def day(d: date) -> datetime:
    """BSON has no date type; dates are stored as midnight datetimes."""
    return datetime.combine(d, time.min)


def to_obj(doc: dict | None) -> SimpleNamespace | None:
    """Mongo document -> attribute-style object with str `id` and a real `txn_date` date."""
    if doc is None:
        return None
    d = dict(doc)
    d["id"] = str(d.pop("_id"))
    if isinstance(d.get("txn_date"), datetime):
        d["txn_date"] = d["txn_date"].date()
    return SimpleNamespace(**d)


def find_txns(db, flt: dict) -> list[SimpleNamespace]:
    return [to_obj(d) for d in db.transactions.find(flt)]


def get_business(db, business_id: str) -> SimpleNamespace | None:
    _id = oid(business_id)
    return to_obj(db.businesses.find_one({"_id": _id})) if _id else None
