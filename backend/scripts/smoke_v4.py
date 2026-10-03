# End-to-end self-check: sandbox bank feed, Profit Coach advisor, customer portal (login, pay, failed payment, dispute).
# Needs: pip install mongomock httpx.   Run from backend/:  PYTHONIOENCODING=utf-8 python scripts/smoke_v4.py
import os
import sys

os.environ["REMINDERS_ENABLED"] = "false"
os.environ["GROQ_API_KEY"] = ""  # tests assume the offline rules engine, whatever is in .env
sys.path.insert(0, ".")
import mongomock, pymongo  # noqa: E402

pymongo.MongoClient = mongomock.MongoClient


def _bw(self, ops, **k):
    for o in ops:
        self.update_one(o._filter, o._doc)


mongomock.collection.Collection.bulk_write = _bw
from datetime import date, timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import bank_service as bank  # noqa: E402
from app.db.session import database as db  # noqa: E402

c = TestClient(app)
d = lambda n: (date.today() + timedelta(days=n)).isoformat()  # noqa: E731
P = "/api/v1"

tok = c.post(f"{P}/auth/register", json={"name": "Owner", "phone": "9300000001", "password": "secret1", "business_name": "Gowurk", "business_type": "Services", "city": "Pune", "opening_balance": 50000}).json()["access_token"]
H = {"Authorization": "Bearer " + tok}
c.post(f"{P}/demo/seed", headers=H)

# ---------------------------------------------------------------- narration parsing
assert bank.parse_narration("UPI/CR/412345678901/ZENITH RESIDENCY/SBXN/Payment") == {"mode": "UPI", "ref": "412345678901", "name": "ZENITH RESIDENCY"}
assert bank.parse_narration("NEFT/998877665544/LAXMI TRADERS")["name"] == "LAXMI TRADERS"
assert bank.parse_narration("POS/GOOGLE ADS/123")["mode"] == "Card"
print("narration ok")

# ---------------------------------------------------------------- bank link + sync
assert c.get(f"{P}/bank", headers=H).json()["account"] is None
assert c.post(f"{P}/bank/sync", headers=H).status_code == 404
before = c.get(f"{P}/transactions?limit=1", headers=H).json()["total"]
r = c.post(f"{P}/bank/link", headers=H, json={"bank": "sbx_national"})
assert r.status_code == 201, r.text
first = r.json()["sync"]
assert first["imported"] + first["duplicate"] > 30, first
after = c.get(f"{P}/transactions?limit=1", headers=H).json()["total"]
assert after == before + first["new"], (before, after, first)
assert c.post(f"{P}/bank/link", headers=H, json={"bank": "sbx_national"}).status_code == 409
again = c.post(f"{P}/bank/sync", headers=H).json()
assert again["new"] <= 1 and again["matched"] == 0, again  # nothing re-imported; at most one live drip line
acct = c.get(f"{P}/bank", headers=H).json()["account"]
assert acct["masked"].startswith("XXXX") and acct["live"]
feed = c.get(f"{P}/bank/feed?limit=10", headers=H).json()
assert feed["items"] and feed["pending"] == 0
imported = db.transactions.find_one({"bank_ref": {"$exists": True}})
assert imported and imported["category_method"] == "BANK" and imported["description"].startswith("Bank sync")
print("bank link/sync ok:", first)

import datetime as dt  # noqa: E402

me_bid = c.get(f"{P}/auth/me", headers=H).json()["business"]["id"]


def mk(party, phone, amount, token, days=-4):
    db.receivables.insert_one({"business_id": me_bid, "kind": "receivable", "party": party, "phone": phone, "email": None, "amount": float(amount), "due_date": dt.datetime.combine(date.today() + timedelta(days=days), dt.time.min),
                               "note": "Test invoice", "paid": False, "payments": [], "events": [], "steps_sent": [], "token": token, "lang": "en", "late_fee_pct": 0, "auto_remind": True, "created_at": dt.datetime.now(dt.timezone.utc)})


mk("Zenith Residency Society – Home Services", "9822011105", 168000, "tok-zen")
# a customer pays an open invoice through the bank app -> the feed settles that udhaar, no double booking
open_r = [x for x in c.get(f"{P}/receivables", headers=H).json()["items"] if x["kind"] == "receivable" and not x["paid"] and not x["claim"]][0]
party = open_r["party"].split(" – ")[0]
c.post(f"{P}/bank/live", headers=H, json={"live": False})
sim = c.post(f"{P}/bank/simulate", headers=H, json={"kind": "credit", "name": party, "amount": min(1000, open_r["outstanding"]), "mode": "UPI"})
assert sim.status_code == 200, sim.text
s2 = c.post(f"{P}/bank/sync", headers=H).json()
assert s2["matched"] == 1 and s2["new"] == 0, s2
now_r = next(x for x in c.get(f"{P}/receivables", headers=H).json()["items"] if x["id"] == open_r["id"])
assert now_r["paid_amount"] >= min(1000, open_r["outstanding"]) - 0.01
# a plain vendor payment is booked as an expense with a category
c.post(f"{P}/bank/simulate", headers=H, json={"kind": "debit", "name": "Airtel Broadband", "amount": 1180, "mode": "UPI"})
s3 = c.post(f"{P}/bank/sync", headers=H).json()
assert s3["new"] == 1, s3
t = db.transactions.find_one({"bank_ref": {"$exists": True}, "amount": 1180.0})
assert t["type"] == "expense" and t["category"] == "Utilities", t
# identical line already on the books is skipped, not doubled
c.post(f"{P}/bank/simulate", headers=H, json={"kind": "debit", "name": "Airtel Broadband", "amount": 1180, "mode": "UPI"})
s4 = c.post(f"{P}/bank/sync", headers=H).json()
assert s4["duplicate"] == 1 and s4["new"] == 0, s4
# accountants cannot move or sync money; revoke keeps the books
c.post(f"{P}/team", headers=H, json={"name": "CA", "phone": "9300000002", "password": "secret22"})
A = {"Authorization": "Bearer " + c.post(f"{P}/auth/login", json={"phone": "9300000002", "password": "secret22"}).json()["access_token"]}
assert c.post(f"{P}/bank/sync", headers=A).status_code == 403
assert c.get(f"{P}/bank/feed", headers=A).status_code == 200
assert c.delete(f"{P}/bank", headers=H).status_code == 204
assert c.get(f"{P}/bank", headers=H).json()["account"] is None
assert db.transactions.find_one({"bank_ref": {"$exists": True}})
print("bank matching/duplicates/revoke ok")

# ---------------------------------------------------------------- Profit Coach
a = c.get(f"{P}/advisor", headers=H).json()
assert a["insufficient"] is False, a
assert 0 <= a["health"]["score"] <= 100 and len(a["health"]["factors"]) == 5 and sum(f["score"] for f in a["health"]["factors"]) == a["health"]["score"]
assert len(a["months"]) == 6 and a["recommendations"] and a["potential_monthly"] >= 0
codes = {r["code"] for r in a["recommendations"]}
assert all(r["priority"] in ("high", "medium", "low") and r["id"] for r in a["recommendations"])
assert abs(a["pnl"]["profit"] - (a["pnl"]["revenue"] - a["pnl"]["expenses"])) <= 1  # each figure is rounded separately
assert len(a["calendar"]) == 4 and a["calendar"][0]["days"] >= 0
print("advisor ok:", a["pnl"]["margin"], "% margin;", sorted(codes))
fresh = c.post(f"{P}/auth/register", json={"name": "New", "phone": "9300000009", "password": "secret1", "business_name": "Tiny", "business_type": "Retail", "city": "Pune"}).json()["access_token"]
assert c.get(f"{P}/advisor", headers={"Authorization": "Bearer " + fresh}).json()["insufficient"] is True
assert c.get(f"{P}/advisor/note?lang=hi", headers=H).json()["mode"] == "rules"  # no Groq key in tests
ans = c.post(f"{P}/ai/ask", headers=H, json={"question": "How can I be more profitable?"}).json()
assert ans["trace"] and ans["trace"][0]["tool"] == "get_profit_advice" and "margin" in ans["answer"].lower(), ans
print("advisor via DHAN AI ok")

# ---------------------------------------------------------------- customer portal
CPHONE = "9822011199"
mk("Walk-in Customer – Invoice", "+91 98220 11199", 5000, "tok-cust-1")
assert c.post(f"{P}/auth/customer/otp", json={"phone": "9300000001"}).status_code == 409  # already an owner
code = c.post(f"{P}/auth/customer/otp", json={"phone": CPHONE}).json()["demo_code"]
assert c.post(f"{P}/auth/customer/register", json={"phone": CPHONE, "code": "000000", "name": "Cust", "password": "secret1"}).status_code == 401
ct = c.post(f"{P}/auth/customer/register", json={"phone": CPHONE, "code": code, "name": "Rahul Customer", "password": "secret1"})
assert ct.status_code == 200, ct.text
C = {"Authorization": "Bearer " + ct.json()["access_token"]}
me_c = c.get(f"{P}/auth/me", headers=C).json()
assert me_c["role"] == "customer" and me_c["business"] is None
# isolation: a customer cannot touch the owner side
for url in ("/dashboard/overview", "/transactions", "/receivables", "/bank", "/advisor", "/ai/status", "/team"):
    assert c.get(P + url, headers=C).status_code == 403, url
assert c.get(f"{P}/notifications/stream?token={ct.json()['access_token']}").status_code == 403
# and the owner cannot use the customer portal
assert c.get(f"{P}/customer/overview", headers=H).status_code == 403

ov = c.get(f"{P}/customer/overview", headers=C).json()
assert ov["totals"]["open"] == 1 and ov["totals"]["outstanding"] == 5000 and ov["shops"][0]["shop"]["name"] == "Gowurk", ov
inv_id = ov["shops"][0]["open"][0]["id"]
# other people's invoices are invisible (unknown phone sees nothing; guessing an id 404s)
other = c.post(f"{P}/auth/customer/otp", json={"phone": "9111111111"}).json()["demo_code"]
O = {"Authorization": "Bearer " + c.post(f"{P}/auth/customer/register", json={"phone": "9111111111", "code": other, "name": "Other", "password": "secret1"}).json()["access_token"]}
assert c.get(f"{P}/customer/overview", headers=O).json()["totals"]["open"] == 0
assert c.get(f"{P}/customer/invoices/{inv_id}", headers=O).status_code == 404
assert c.post(f"{P}/customer/invoices/{inv_id}/pay", headers=O, json={}).status_code == 404

# failed payment -> owner is told, customer sees it, then retry succeeds
f = c.post(f"{P}/customer/invoices/{inv_id}/pay", headers=C, json={"method": "upi", "test": "insufficient_funds"}).json()
assert f["status"] == "failed" and f["reason"] == "insufficient_funds"
inv = c.get(f"{P}/customer/invoices/{inv_id}", headers=C).json()
assert inv["failed"]["reason"] == "insufficient_funds" and inv["outstanding"] == 5000
notes = c.get(f"{P}/notifications", headers=H).json()["items"]
assert notes[0]["type"] == "pay_failed" and notes[0]["params"]["reason"] == "insufficient_funds"
owner_view = next(x for x in c.get(f"{P}/receivables", headers=H).json()["items"] if x["id"] == inv_id)
assert owner_view["last_failure"]["type"] == "pay_failed"
part = c.post(f"{P}/customer/invoices/{inv_id}/pay", headers=C, json={"amount": 2000, "test": "success"}).json()
assert part["status"] == "paid" and part["outstanding"] == 3000 and not part["settled"] and part["receipt"].startswith("DHN")
cash_before = db.transactions.count_documents({"business_id": me_bid})
assert db.transactions.find_one({"business_id": me_bid, "amount": 2000.0, "vendor": "Walk-in Customer – Invoice"})  # booked as income like any payment

# dispute pauses reminders; owner replies and resolves; customer sees the reply
assert c.post(f"{P}/customer/invoices/{inv_id}/dispute", headers=C, json={"reason": "wrong_amount", "text": "Should be 4000"}).status_code == 200
assert db.receivables.find_one({"token": "tok-cust-1"})["disputed"] is True
from app.services import udhaar_service as u  # noqa: E402

assert u.run_reminders(db) == 0 or db.receivables.find_one({"token": "tok-cust-1"}).get("steps_sent") == []  # disputed entry is skipped
assert c.post(f"{P}/receivables/{inv_id}/reply", headers=H, json={"text": "You're right, corrected.", "resolve_dispute": True}).status_code == 200
assert not db.receivables.find_one({"token": "tok-cust-1"}).get("disputed")
ov2 = c.get(f"{P}/customer/overview", headers=C).json()
assert any(a_["type"] == "msg" and a_["params"]["text"].startswith("You're right") for a_ in ov2["activity"])
assert c.post(f"{P}/customer/invoices/{inv_id}/message", headers=C, json={"text": "Thanks!"}).status_code == 200
fin = c.post(f"{P}/customer/invoices/{inv_id}/pay", headers=C, json={"method": "card", "test": "success"}).json()
assert fin["settled"] and fin["outstanding"] == 0
assert c.post(f"{P}/customer/invoices/{inv_id}/pay", headers=C, json={}).status_code == 409
assert c.get(f"{P}/customer/overview", headers=C).json()["totals"]["open"] == 0
login = c.post(f"{P}/auth/login", json={"phone": CPHONE, "password": "secret1"})
assert login.status_code == 200

# ---------------------------------------------------------------- Razorpay Checkout (mocked network, real signature check)
import hashlib, hmac as _hmac  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.services import razorpay_service as rz  # noqa: E402

os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"] = "rzp_test_abc", "sekret"
get_settings.cache_clear()


class _R:
    status_code = 200

    def raise_for_status(self):
        pass

    def json(self):
        return {"id": "order_T1", "amount": 150000}


rz.requests.post = lambda *a, **k: _R()
mk("Razor Customer – Invoice", "9822011188", 4000, "tok-rzp")
rc = c.post(f"{P}/auth/customer/otp", json={"phone": "9822011188"}).json()["demo_code"]
RC = {"Authorization": "Bearer " + c.post(f"{P}/auth/customer/register", json={"phone": "9822011188", "code": rc, "name": "Razor", "password": "secret1"}).json()["access_token"]}
rid = c.get(f"{P}/customer/overview", headers=RC).json()["shops"][0]["open"][0]["id"]
assert c.get(f"{P}/customer/invoices/{rid}", headers=RC).json()["razorpay"] == "test"
o = c.post(f"{P}/customer/invoices/{rid}/rzp/order", headers=RC, json={"amount": 1500}).json()
assert o["key"] == "rzp_test_abc" and o["order_id"] == "order_T1" and o["amount"] == 150000 and o["test"] is True, o
bad = c.post(f"{P}/customer/invoices/{rid}/rzp/verify", headers=RC, json={"razorpay_order_id": "order_T1", "razorpay_payment_id": "pay_1", "razorpay_signature": "nope"})
assert bad.status_code == 400
sig = _hmac.new(b"sekret", b"order_T1|pay_1", hashlib.sha256).hexdigest()
ok = c.post(f"{P}/customer/invoices/{rid}/rzp/verify", headers=RC, json={"razorpay_order_id": "order_T1", "razorpay_payment_id": "pay_1", "razorpay_signature": sig}).json()
assert ok["status"] == "paid" and ok["amount"] == 1500 and ok["outstanding"] == 2500, ok
assert c.post(f"{P}/customer/invoices/{rid}/rzp/verify", headers=RC, json={"razorpay_order_id": "order_T1", "razorpay_payment_id": "pay_1", "razorpay_signature": sig}).status_code == 409  # replay
fl = c.post(f"{P}/customer/invoices/{rid}/rzp/failed", headers=RC, json={"order_id": "order_T1", "reason": "cancelled"}).json()
assert fl["status"] == "failed" and fl["reason"] == "cancelled"
assert c.get(f"{P}/notifications", headers=H).json()["items"][0]["type"] == "pay_failed"
# the login-free pay page uses the same flow
rz.requests.post = lambda *a, **k: type("R2", (_R,), {"json": lambda self: {"id": "order_T2", "amount": 250000}})()
po = c.post(f"{P}/public/udhaar/tok-rzp/rzp/order", json={}).json()
assert po["order_id"] == "order_T2" and po["amount"] == 250000, po
sig2 = _hmac.new(b"sekret", b"order_T2|pay_2", hashlib.sha256).hexdigest()
pv = c.post(f"{P}/public/udhaar/tok-rzp/rzp/verify", json={"razorpay_order_id": "order_T2", "razorpay_payment_id": "pay_2", "razorpay_signature": sig2}).json()
assert pv["settled"] is True, pv
assert c.post(f"{P}/public/udhaar/tok-rzp/rzp/order", json={}).status_code == 409  # nothing left to pay
print("razorpay checkout flow ok")
print("customer portal ok")

# ---------------------------------------------------------------- bill scan (AI vision first) and spoken answers
from app.services import groq_service, tts_service  # noqa: E402

os.environ["GROQ_API_KEY"] = "gsk-test"
get_settings.cache_clear()
groq_service.read_bill = lambda img, mime: {"vendor": "Laxmi Stationery", "amount": 750.0, "date": "2026-09-28", "gstin": "27ABCDE1234F1Z5", "category": "Not A Category", "payment_mode": "UPI"}
r = c.post(f"{P}/transactions/ocr", headers=H, files={"file": ("b.jpg", b"x" * 50, "image/jpeg")})
assert r.status_code == 200 and r.json()["method"] == "dhan-ai-vision", r.text
f = r.json()["fields"]
assert f["amount"]["value"] == 750 and f["category"]["value"] == "Others" and f["gstin"]["value"] == "27ABCDE1234F1Z5" and f["payment_mode"]["value"] == "UPI"


def _unreadable(img, mime):
    raise groq_service.Unavailable("unreadable")


groq_service.read_bill = _unreadable
bad = c.post(f"{P}/transactions/ocr", headers=H, files={"file": ("b.jpg", b"x" * 50, "image/jpeg")})
assert bad.status_code == 503 and "clearer" in bad.json()["detail"]
assert tts_service.clean("आज ₹1,23,456 मिळाले **खरे**", "mr") == "आज 123456 रुपये मिळाले खरे"


async def _fake(text, lang):
    return b"ID3" + lang.encode()


tts_service.synthesize = _fake
sp = c.post(f"{P}/voice/speak", headers=H, json={"text": "नमस्कार", "lang": "mr"})
assert sp.status_code == 200 and sp.headers["content-type"] == "audio/mpeg" and sp.content == b"ID3mr"
assert c.post(f"{P}/voice/speak", json={"text": "x", "lang": "mr"}).status_code == 401
print("bill scan + spoken answers ok")
os.environ["GROQ_API_KEY"] = ""
get_settings.cache_clear()
print("ALL OK")
