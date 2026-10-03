"""Online payment of a receivable through Razorpay Checkout (test keys give test mode, live keys real money).

Flow: the customer asks for an order -> we create it at Razorpay and remember (order, receivable, amount) -> Checkout
runs in the browser -> on success the browser sends the signed result and we verify the signature, then book the money
exactly like a webhook would; on failure the attempt is logged and the owner is told. The amount always comes from our own
record of the order, never from the browser.
"""

from pymongo.database import Database

from app.core.config import get_settings
from app.db.session import get_business
from app.services import razorpay_service, udhaar_service as u


class PayError(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail


def enabled() -> bool:
    return razorpay_service.enabled()


def mode() -> str | None:
    """"test" for rzp_test_ keys, "live" for real keys, None when online payment is not set up."""
    if not enabled():
        return None
    return "test" if (get_settings().razorpay_key_id or "").startswith("rzp_test_") else "live"


def create_order(db: Database, doc: dict, amount: float | None) -> dict:
    owed = u.outstanding_of(doc)
    if doc["paid"] or owed <= 0:
        raise PayError(409, "This invoice is already paid.")
    amount = round(min(amount or owed, owed), 2)
    if amount < 1:
        raise PayError(422, "The minimum payment is ₹1.")
    if not enabled():
        raise PayError(503, "Online payments are not set up.")
    order = razorpay_service.create_order(amount, str(doc["_id"]))
    if not order:
        raise PayError(502, "Could not reach Razorpay. Try again in a moment.")
    db.rzp_orders.insert_one({"order_id": order["id"], "receivable_id": str(doc["_id"]), "amount": amount, "status": "created", "at": u.now()})
    biz = get_business(db, doc["business_id"])
    prefill = {"name": doc["party"].split(" – ")[0]}
    if doc.get("email"):
        prefill["email"] = doc["email"]
    digits = "".join(c for c in (doc.get("phone") or "") if c.isdigit())[-10:]
    if len(digits) == 10:
        prefill["contact"] = digits
    return {"key": get_settings().razorpay_key_id, "order_id": order["id"], "amount": order["amount"], "currency": "INR", "name": biz.name,
            "description": doc.get("note") or "Payment", "prefill": prefill, "test": (get_settings().razorpay_key_id or "").startswith("rzp_test_")}


def verify(db: Database, doc: dict, order_id: str, payment_id: str, signature: str, party: str) -> dict:
    order = db.rzp_orders.find_one({"order_id": order_id, "receivable_id": str(doc["_id"])})
    if not order or not razorpay_service.verify_signature(order_id, payment_id, signature):
        raise PayError(400, "Payment could not be verified.")
    # Atomically claim the order so a replayed callback can never book the money twice.
    claimed = db.rzp_orders.find_one_and_update({"_id": order["_id"], "status": {"$ne": "paid"}}, {"$set": {"status": "paid", "payment_id": payment_id}})
    if not claimed:
        raise PayError(409, "This payment was already recorded.")
    after = u.apply_payment(db, doc, order["amount"], "UPI", "razorpay")
    u.notify(db, doc["business_id"], "payment_auto", doc["_id"], party=party, amount=order["amount"])
    return {"status": "paid", "amount": order["amount"], "receipt": payment_id, "outstanding": u.outstanding_of(after), "settled": after["paid"]}


def failed(db: Database, doc: dict, order_id: str | None, reason: str, detail: str | None, party: str) -> dict:
    order = db.rzp_orders.find_one({"order_id": order_id, "receivable_id": str(doc["_id"])}) if order_id else None
    amount = order["amount"] if order else u.outstanding_of(doc)
    reason = reason if reason in ("cancelled", "declined", "insufficient_funds", "bank_down") else "declined"
    u.log_event(db, doc["_id"], "pay_failed", reason=reason, amount=amount, method="razorpay", detail=(detail or "")[:160] or None)
    u.notify(db, doc["business_id"], "pay_failed", doc["_id"], party=party, amount=amount, reason=reason)
    return {"status": "failed", "reason": reason, "amount": amount, "detail": detail}
