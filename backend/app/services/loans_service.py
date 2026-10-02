"""Loan marketplace (SIMULATED lenders). Offers are computed from the same verified numbers as the Credit Passport:
score, months of records, average monthly income and open invoices. Lender names are fictional; no money moves.
Every lender's criteria are listed in LENDERS so an ineligible user is told exactly what to improve."""

from datetime import date, datetime, timedelta, timezone

from pymongo.database import Database

from app.services import udhaar_service as u
from app.services.credit_service import get_credit_readiness

LENDERS = [
    {"id": "udyam-capital", "name": "Udyam Capital", "type": "NBFC", "product": "Working capital loan", "tagline": "Fast cash for stock, salaries and growth",
     "min_score": 55, "min_months": 3, "min_income": 150000, "multiple": 3.0, "max": 5_000_000, "base": 15.5, "tenures": [6, 12, 18, 24], "fee": 1.5, "speed": "2 days"},
    {"id": "shakti-bank", "name": "Shakti Small Business Bank", "type": "Bank", "product": "Business term loan", "tagline": "Lowest rates for established, well-documented businesses",
     "min_score": 70, "min_months": 6, "min_income": 300000, "multiple": 4.0, "max": 10_000_000, "base": 11.9, "tenures": [12, 24, 36, 48], "fee": 1.0, "speed": "7 days"},
    {"id": "flexicash", "name": "FlexiCash", "type": "Fintech", "product": "Revolving credit line", "tagline": "Draw only what you need, repay when you can",
     "min_score": 50, "min_months": 2, "min_income": 80000, "multiple": 1.5, "max": 1_500_000, "base": 18.0, "tenures": [3, 6, 9, 12], "fee": 2.0, "speed": "Same day"},
    {"id": "billbridge", "name": "BillBridge", "type": "Invoice financing", "product": "Invoice discounting", "tagline": "Get paid today for invoices your customers pay later",
     "min_score": 45, "min_months": 3, "basis": "receivables", "advance": 0.8, "max": 4_000_000, "base": 16.8, "tenures": [1, 2, 3], "fee": 1.0, "speed": "1 day"},
    {"id": "greenleaf", "name": "GreenLeaf MSME Finance", "type": "NBFC", "product": "Growth and equipment loan", "tagline": "Bigger tickets for expansion and equipment",
     "min_score": 60, "min_months": 6, "min_income": 200000, "multiple": 5.0, "max": 8_000_000, "base": 13.8, "tenures": [12, 24, 36, 60], "fee": 1.25, "speed": "5 days"},
]
AUTO_REVIEW_SECONDS, AUTO_DECIDE_SECONDS = 12, 45  # simulation clock so a demo shows the full journey in under a minute


def emi(principal: float, rate_pa: float, months: int) -> int:
    r = rate_pa / 1200
    return round(principal * r * (1 + r) ** months / ((1 + r) ** months - 1)) if r else round(principal / months)


def profile(db: Database, bid: str, today: date | None = None) -> dict:
    from app.api.passport import snapshot  # local import: avoids a router import cycle at module load

    snap = snapshot(db, bid)
    credit = snap["credit"]
    eligible_receivables = sum(u.outstanding_of(r) for r in db.receivables.find({"business_id": bid, "kind": "receivable", "paid": False}) if u.days_overdue(r, today or date.today()) <= 60)
    return {"score": None if credit.get("insufficient_history") else round(credit["score"]), "band": credit.get("band"), "months": snap["months_of_records"],
            "avg_income": snap["last_90_days"]["avg_monthly_income"], "open_receivables": round(eligible_receivables)}


def _rate(lender: dict, score: int) -> float:
    adj = -1.5 if score >= 85 else -0.7 if score >= 70 else 0.0 if score >= 55 else 1.2
    return round(lender["base"] + adj, 1)


def evaluate(lender: dict, p: dict) -> dict:
    reasons = []
    if p["score"] is None or p["score"] < lender["min_score"]:
        reasons.append({"key": "score", "have": p["score"], "need": lender["min_score"]})
    if p["months"] < lender["min_months"]:
        reasons.append({"key": "months", "have": p["months"], "need": lender["min_months"]})
    if lender.get("basis") == "receivables":
        amount = min(lender["max"], p["open_receivables"] * lender["advance"])
        if amount < 50_000:
            reasons.append({"key": "receivables", "have": p["open_receivables"], "need": round(50_000 / lender["advance"])})
    else:
        if p["avg_income"] < lender["min_income"]:
            reasons.append({"key": "income", "have": p["avg_income"], "need": lender["min_income"]})
        amount = min(lender["max"], p["avg_income"] * lender["multiple"])
    base = {k: lender[k] for k in ("id", "name", "type", "product", "tagline", "speed")}
    if reasons:
        return {**base, "eligible": False, "reasons": reasons}
    amount = max(50_000, int(amount // 10_000 * 10_000))
    rate = _rate(lender, p["score"])
    tenures = lender["tenures"]
    default = tenures[len(tenures) // 2]
    return {**base, "eligible": True, "amount": amount, "rate": rate, "fee_pct": lender["fee"], "tenures": tenures, "default_tenure": default, "emi": emi(amount, rate, default),
            "basis": "receivables" if lender.get("basis") == "receivables" else "income"}


def offers(db: Database, bid: str, today: date | None = None) -> dict:
    p = profile(db, bid, today)
    results = [evaluate(l, p) for l in LENDERS]
    good = sorted((r for r in results if r["eligible"]), key=lambda r: (r["rate"], -r["amount"]))
    return {"profile": p, "offers": good, "ineligible": [r for r in results if not r["eligible"]], "max_amount": max((o["amount"] for o in good), default=0),
            "disclaimer": "Simulated lenders and indicative terms. No real lending happens in this demo."}


def lender_by_id(lender_id: str) -> dict | None:
    return next((l for l in LENDERS if l["id"] == lender_id), None)


def progress(db: Database, app: dict) -> dict:
    """Move a pending application along on the simulation clock (unless a lender already decided)."""
    if app["status"] not in ("submitted", "reviewing"):
        return app
    age = (datetime.now(timezone.utc) - app["created_at"].replace(tzinfo=timezone.utc)).total_seconds()
    now = datetime.now(timezone.utc)
    if age >= AUTO_DECIDE_SECONDS:
        decision = {"by": "auto", "amount": app["amount"], "rate": app["rate"], "tenure": app["tenure"]}
        db.loan_applications.update_one({"_id": app["_id"]}, {"$set": {"status": "approved", "decision": decision}, "$push": {"events": {"stage": "approved", "at": now}}})
        u.notify(db, app["business_id"], "loan_approved", "", lender=app["lender_name"], amount=app["amount"], rate=app["rate"], app_id=str(app["_id"]))
    elif age >= AUTO_REVIEW_SECONDS and app["status"] == "submitted":
        db.loan_applications.update_one({"_id": app["_id"]}, {"$set": {"status": "reviewing"}, "$push": {"events": {"stage": "reviewing", "at": now}}})
    return db.loan_applications.find_one({"_id": app["_id"]})


def serialize(app: dict) -> dict:
    return {
        "id": str(app["_id"]), "lender_id": app["lender_id"], "lender_name": app["lender_name"], "product": app["product"], "amount": app["amount"], "tenure": app["tenure"],
        "rate": app["rate"], "fee_pct": app["fee_pct"], "emi": app["emi"], "status": app["status"], "decision": app.get("decision"), "events": app.get("events", []),
        "created_at": app["created_at"], "passport_token": app["passport_token"],
    }
