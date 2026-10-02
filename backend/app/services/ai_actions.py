"""DHAN AI's action planner. The model (or rules engine) can only PROPOSE; nothing runs until the owner taps Approve.

Every action is a whitelisted, typed operation with explicit parameters, so a hallucinating model cannot do
anything outside this file. The plan is computed deterministically from the cash calendar and udhaar data, and
its effect is tested by re-running the calendar with the fix applied, so the promised impact is the real number.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from pymongo.database import Database

from app.db.session import day, get_business, oid
from app.services import audit, udhaar_service as u
from app.services.cash_calendar import cash_calendar

REMIND_COOLDOWN_DAYS = 3
DELAY_DAYS = 10
MAX_REMINDERS, MAX_DELAYS = 6, 2


def _prob(label_score: int | None) -> float:
    return max(0.3, min(0.95, (label_score if label_score is not None else 60) / 100))


def _step(overdue: int) -> str:
    return "late7" if overdue >= 7 else "late3" if overdue > 0 else "pre"


def plan(db: Database, bid: str, lang: str = "en", today: date | None = None) -> dict:
    today = today or date.today()
    cal = cash_calendar(db, bid, 45, today=today)
    if cal.get("insufficient_history"):
        return {"actions": [], "impact": None, "reason": "insufficient"}
    crunch = cal["crunch"]
    scores = {c["key"]: c["score"] for c in u.customers(db, bid, today)}
    open_docs = list(db.receivables.find({"business_id": bid, "paid": False}))
    receivables = [d for d in open_docs if d["kind"] == "receivable"]
    payables = [d for d in open_docs if d["kind"] == "payable"]

    # 1) chase the invoices most worth chasing
    cands = []
    for r in receivables:
        if not (r.get("email") or r.get("phone")) or r.get("claim"):
            continue
        promise = r.get("promise_date")
        if promise and promise.date() >= today:
            continue
        sent = [e["at"] for e in r.get("events", []) if e["type"] in ("sent", "auto_reminder")]
        if sent and today - max(sent).replace(tzinfo=timezone.utc).date() < timedelta(days=REMIND_COOLDOWN_DAYS):
            continue
        if u.days_overdue(r, today) > 0 or crunch:
            cands.append(r)
    cands.sort(key=lambda r: (-u.days_overdue(r, today), -u.outstanding_of(r)))
    cands = cands[:MAX_REMINDERS]

    actions = []
    if cands:
        actions.append({"type": "send_reminders", "params": {"ids": [str(r["_id"]) for r in cands], "parties": [r["party"] for r in cands], "total": round(sum(u.outstanding_of(r) for r in cands))}})

    # 2) if cash dips, push the largest not-yet-due bills back
    delays = {}
    if crunch:
        horizon = date.fromisoformat(crunch["date"]) + timedelta(days=3)
        pick = sorted((p for p in payables if today < u.due_of(p) <= horizon), key=lambda p: -u.outstanding_of(p))[:MAX_DELAYS]
        for p in pick:
            delays[str(p["_id"])] = u.due_of(p) + timedelta(days=DELAY_DAYS)
            actions.append({"type": "delay_bill", "params": {"id": str(p["_id"]), "party": p["party"], "amount": u.outstanding_of(p), "from": u.due_of(p).isoformat(), "to": delays[str(p["_id"])].isoformat()}})

    # 3) switch on auto-reminders where they're off
    off = [r for r in receivables if not r.get("auto_remind") and (r.get("email") or r.get("phone"))]
    if off:
        actions.append({"type": "enable_auto_remind", "params": {"ids": [str(r["_id"]) for r in off], "parties": [r["party"] for r in off]}})

    # impact: replay the calendar with the delays applied and the chased invoices collected (reliability-weighted) in 4 days
    collect = {str(r["_id"]): (today + timedelta(days=4), _prob(scores.get(u.customer_key(r)))) for r in cands}
    after = cash_calendar(db, bid, 45, today=today, payable_due={k: v for k, v in delays.items()}, collect=collect)
    impact = {"buffer": cal["buffer"], "before_lowest": cal["lowest"]["balance"], "after_lowest": after["lowest"]["balance"], "crunch_before": crunch, "crunch_after": after["crunch"],
              "resolves": bool(crunch) and after["crunch"] is None}

    for old in db.ai_actions.find({"business_id": bid, "status": "pending"}):
        db.ai_actions.update_one({"_id": old["_id"]}, {"$set": {"status": "superseded"}})
    plan_id, now = uuid.uuid4().hex[:10], datetime.now(timezone.utc)
    for a in actions:
        a.update(business_id=bid, plan_id=plan_id, status="pending", created_at=now)
        a["_id"] = db.ai_actions.insert_one(dict(a)).inserted_id
    return {"actions": [serialize(a) for a in actions], "impact": impact, "reason": None}


def serialize(a: dict) -> dict:
    return {"id": str(a["_id"]), "type": a["type"], "params": a["params"], "status": a["status"], "result": a.get("result")}


def _get(db: Database, bid: str, action_id: str) -> dict | None:
    _id = oid(action_id)
    return db.ai_actions.find_one({"_id": _id, "business_id": bid}) if _id else None


def execute(db: Database, user, action_id: str, lang: str = "en") -> dict:
    a = _get(db, user.business_id, action_id)
    if not a:
        return {"error": "not-found"}
    if a["status"] != "pending":
        return {"error": "not-pending"}
    p, result = a["params"], {}
    try:
        if a["type"] == "send_reminders":
            business = vars(get_business(db, user.business_id))
            sent = 0
            for rid in p["ids"]:
                doc = db.receivables.find_one({"_id": oid(rid), "business_id": user.business_id, "paid": False})
                if not doc:
                    continue
                channels = [c for c, v in (("email", doc.get("email")), ("whatsapp", doc.get("phone"))) if v]
                if channels and u.dispatch(db, doc, business, channels, _step(u.days_overdue(doc, date.today())), doc.get("lang", "en")):
                    sent += 1
            result = {"sent": sent, "total": len(p["ids"])}
        elif a["type"] == "delay_bill":
            db.receivables.update_one({"_id": oid(p["id"]), "business_id": user.business_id}, {"$set": {"due_date": day(date.fromisoformat(p["to"]))}})
            u.log_event(db, oid(p["id"]), "due_changed", old=p["from"], new=p["to"])
            result = {"new_due": p["to"]}
        elif a["type"] == "enable_auto_remind":
            db.receivables.update_many({"_id": {"$in": [oid(i) for i in p["ids"]]}, "business_id": user.business_id}, {"$set": {"auto_remind": True}})
            result = {"enabled": len(p["ids"])}
        else:
            return {"error": "unsupported"}
        status = "executed"
    except Exception as exc:  # never half-report: record the failure on the action
        status, result = "failed", {"error": str(exc)[:160]}
    db.ai_actions.update_one({"_id": a["_id"]}, {"$set": {"status": status, "result": result, "executed_at": datetime.now(timezone.utc)}})
    audit.log(db, user, "ai.action", type=a["type"], status=status)
    return serialize(db.ai_actions.find_one({"_id": a["_id"]}))


def skip(db: Database, user, action_id: str) -> dict:
    a = _get(db, user.business_id, action_id)
    if not a or a["status"] != "pending":
        return {"error": "not-pending"}
    db.ai_actions.update_one({"_id": a["_id"]}, {"$set": {"status": "skipped"}})
    return serialize(db.ai_actions.find_one({"_id": a["_id"]}))
