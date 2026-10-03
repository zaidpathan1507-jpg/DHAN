"""Udhaar (receivables / payables) domain logic: timeline, payments, messages, reminders, customer reliability.

An entry's story lives in its own document (`events`, `payments`, `claim`, `promise_date`) so the owner's screen,
the customer's pay page and the reminder scheduler all read one source of truth.
"""

import html
import secrets
from datetime import date, datetime, timedelta, timezone

from pymongo.database import Database

from app.core.config import get_settings
from app.db.session import day, get_business
from app.services import messaging, razorpay_service

# Reminder ladder: days relative to the due date. Tone gets firmer; see MESSAGES.
STEPS = [("pre", -3), ("due", 0), ("late3", 3), ("late7", 7), ("final", 15)]

MESSAGES = {
    "en": {
        "first": ("Invoice from {business}: ₹{amount} due {date}", "Hello {party}, {business} has shared a payment request of ₹{amount}, due on {date}. See the details and pay here: {link}"),
        "pre": ("Reminder: ₹{amount} due {date}", "Hi {party}, a friendly heads-up from {business}: ₹{amount} is due on {date}. Pay, or tell us your plan, here: {link}"),
        "due": ("₹{amount} is due today", "Hi {party}, your payment of ₹{amount} to {business} is due today. Pay here: {link}"),
        "late3": ("₹{amount} is overdue", "Hello {party}, ₹{amount} to {business} was due on {date} and is still pending. Please pay, or tell us when you will: {link}"),
        "late7": ("Payment overdue by {days} days", "Hello {party}, ₹{amount} owed to {business} is now {days} days overdue. Please settle it today or tell us what is stopping you: {link}"),
        "final": ("Final reminder: ₹{amount} overdue", "Final reminder: ₹{amount} owed to {business} is {days} days overdue. Please pay today, or contact us to agree a plan: {link}"),
    },
    "hi": {
        "first": ("{business} की ओर से इनवॉइस: ₹{amount}, देय {date}", "नमस्ते {party}, {business} ने ₹{amount} का भुगतान अनुरोध भेजा है, देय तिथि {date}। विवरण देखें और यहां भुगतान करें: {link}"),
        "pre": ("याद दिलाना: ₹{amount}, देय {date}", "नमस्ते {party}, {business} की ओर से याद दिलाना: ₹{amount} {date} को देय है। भुगतान करें या अपनी योजना बताएं: {link}"),
        "due": ("₹{amount} आज देय है", "नमस्ते {party}, {business} को ₹{amount} का भुगतान आज देय है। यहां भुगतान करें: {link}"),
        "late3": ("₹{amount} का भुगतान बाकी है", "नमस्ते {party}, {business} को ₹{amount} {date} को देय थे और अभी बाकी हैं। कृपया भुगतान करें या बताएं कब करेंगे: {link}"),
        "late7": ("भुगतान {days} दिन से बाकी", "नमस्ते {party}, {business} के ₹{amount} अब {days} दिन से बाकी हैं। कृपया आज भुगतान करें या कारण बताएं: {link}"),
        "final": ("अंतिम याद: ₹{amount} बाकी", "अंतिम याद: {business} के ₹{amount} {days} दिन से बाकी हैं। कृपया आज भुगतान करें या बात करके योजना तय करें: {link}"),
    },
}


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_token() -> str:
    return secrets.token_urlsafe(16)


def due_of(doc: dict) -> date:
    d = doc["due_date"]
    return d.date() if isinstance(d, datetime) else d


def paid_of(doc: dict) -> float:
    return round(sum(p["amount"] for p in doc.get("payments", [])), 2)


def outstanding_of(doc: dict) -> float:
    return round(max(0.0, doc["amount"] - paid_of(doc)), 2)


def days_overdue(doc: dict, today: date) -> int:
    return 0 if doc.get("paid") else max(0, (today - due_of(doc)).days)


def late_fee_of(doc: dict, today: date) -> float:
    pct = doc.get("late_fee_pct") or 0
    return round(outstanding_of(doc) * pct / 100 * days_overdue(doc, today) / 30, 2)


def link_of(doc: dict) -> str:
    return f"{get_settings().app_base_url.rstrip('/')}/pay/{doc['token']}"


def upi_link(business: dict, doc: dict) -> str | None:
    upi = business.get("upi_id")
    if not upi or doc.get("paid") or doc["kind"] != "receivable":
        return None
    from urllib.parse import quote

    note = quote(f"{business['name']} udhaar")
    return f"upi://pay?pa={quote(upi)}&pn={quote(business['name'])}&am={outstanding_of(doc):.2f}&cu=INR&tn={note}"


def log_event(db: Database, doc_id, type: str, **params) -> None:
    db.receivables.update_one({"_id": doc_id}, {"$push": {"events": {"type": type, "at": now(), "params": params}}})


def notify(db: Database, business_id: str, type: str, receivable_id, **params) -> None:
    db.notifications.insert_one({"business_id": business_id, "type": type, "receivable_id": str(receivable_id), "params": params, "at": now(), "read": False})


def serialize(doc: dict, today: date) -> dict:
    outstanding = outstanding_of(doc)
    sent = [e for e in doc.get("events", []) if e["type"] == "sent"]
    views = [e for e in doc.get("events", []) if e["type"] == "viewed"]
    return {
        "id": str(doc["_id"]), "kind": doc["kind"], "party": doc["party"], "phone": doc.get("phone"), "email": doc.get("email"),
        "amount": doc["amount"], "paid_amount": paid_of(doc), "outstanding": outstanding, "due_date": due_of(doc),
        "note": doc.get("note"), "paid": doc["paid"], "days_overdue": days_overdue(doc, today), "late_fee": late_fee_of(doc, today),
        "late_fee_pct": doc.get("late_fee_pct") or 0, "auto_remind": doc.get("auto_remind", False), "lang": doc.get("lang", "en"),
        "link": link_of(doc), "promise_date": doc["promise_date"].date() if doc.get("promise_date") else None,
        "claim": doc.get("claim"), "views": len(views), "last_viewed_at": views[-1]["at"] if views else None,
        "last_sent_at": sent[-1]["at"] if sent else None, "channels_sent": sorted({e["params"]["channel"] for e in sent}),
        "disputed": bool(doc.get("disputed")), "last_failure": next((e for e in reversed(doc.get("events", [])) if e["type"] in ("pay_failed", "payment")), None),
        "events": doc.get("events", []), "payments": doc.get("payments", []), "razorpay_url": doc.get("razorpay_url"),
    }


def render_message(doc: dict, business_name: str, step: str, lang: str, today: date) -> tuple[str, str]:
    subject, body = MESSAGES.get("hi" if lang == "mr" else lang, MESSAGES["en"])[step]
    vals = {
        "party": doc["party"], "business": business_name, "amount": f"{outstanding_of(doc):,.0f}", "link": link_of(doc),
        "date": due_of(doc).strftime("%d %b"), "days": days_overdue(doc, today),
    }
    return subject.format(**vals), body.format(**vals)


def email_html(business_name: str, party: str, body: str, link: str, amount: float) -> str:
    esc = html.escape
    return (
        f'<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #E2DFD5;border-radius:16px;overflow:hidden">'
        f'<div style="background:#0B1B2B;color:#fff;padding:18px 24px;font-weight:800;letter-spacing:.08em">{esc(business_name)}</div>'
        f'<div style="padding:24px;color:#0B1B2B"><p style="font-size:15px;line-height:1.55">{esc(body).replace(esc(link), "")}</p>'
        f'<p style="font-size:30px;font-weight:800;margin:12px 0">₹{amount:,.0f}</p>'
        f'<a href="{esc(link)}" style="display:inline-block;background:#F0B429;color:#0B1B2B;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:12px">View &amp; pay</a>'
        f'<p style="font-size:12px;color:#566676;margin-top:20px">Sent via DHAN on behalf of {esc(business_name)}.</p></div></div>'
    )


def dispatch(db: Database, doc: dict, business: dict, channels: list[str], step: str, lang: str, today: date | None = None) -> list[dict]:
    """Send one message per requested channel (skipping channels the customer has no contact for) and record each."""
    today = today or date.today()
    subject, body = render_message(doc, business["name"], step, lang, today)
    results = []
    for channel in channels:
        to = doc.get("email") if channel == "email" else doc.get("phone")
        if not to:
            continue
        if channel == "email":
            res = messaging.send_email(to, subject, body, email_html(business["name"], doc["party"], body, link_of(doc), outstanding_of(doc)))
        else:
            res = messaging.send_whatsapp(to, body)
        db.outbox.insert_one({
            "business_id": doc["business_id"], "receivable_id": str(doc["_id"]), "channel": channel, "to": to, "subject": subject,
            "body": body, "step": step, "status": res["status"], "provider": res["provider"], "error": res.get("error"), "created_at": now(),
        })
        log_event(db, doc["_id"], "sent", channel=channel, step=step, status=res["status"])
        results.append({"channel": channel, "to": to, **res})
    return results


def apply_payment(db: Database, doc: dict, amount: float, mode: str = "UPI", source: str = "owner") -> dict:
    """Record a (partial) payment; books the matching LIVE transaction and settles the entry when fully paid."""
    amount = round(min(amount, outstanding_of(doc)), 2)
    if amount <= 0:
        return doc
    income = doc["kind"] == "receivable"
    db.transactions.insert_one({
        "business_id": doc["business_id"], "type": "income" if income else "expense", "amount": amount, "vendor": doc["party"],
        "category": "Sales Revenue" if income else "Others", "txn_date": day(date.today()), "payment_mode": mode,
        "description": f"{'Received' if income else 'Paid'} against udhaar" + (f": {doc['note']}" if doc.get("note") else ""),
        "gstin": None, "source": "LIVE", "is_anomaly": False, "category_method": "RULE", "category_confidence": 100.0, "created_at": now(),
    })
    update = {"$push": {"payments": {"amount": amount, "mode": mode, "at": now(), "source": source}}, "$unset": {"claim": ""}}
    fully = round(outstanding_of(doc) - amount, 2) <= 0
    if fully:
        update["$set"] = {"paid": True, "settled_on": day(date.today())}
    db.receivables.update_one({"_id": doc["_id"]}, update)
    log_event(db, doc["_id"], "payment", amount=amount, mode=mode, source=source)
    if fully:
        log_event(db, doc["_id"], "settled")
    return db.receivables.find_one({"_id": doc["_id"]})


def recovered(docs: list[dict]) -> dict:
    """Money received on invoices AFTER DHAN had already reminded the customer: the honest 'DHAN recovered' figure."""
    amount, invoices = 0.0, set()
    for d in docs:
        reminders = [e["at"].replace(tzinfo=timezone.utc) for e in d.get("events", []) if e["type"] in ("sent", "auto_reminder")]
        if not reminders:
            continue
        first = min(reminders)
        for p in d.get("payments", []):
            if p["at"].replace(tzinfo=timezone.utc) >= first:
                amount += p["amount"]
                invoices.add(d["_id"])
    return {"amount": round(amount), "invoices": len(invoices)}


# ---------------------------------------------------------------- reminders
def due_step(doc: dict, today: date) -> tuple[str | None, list[str]]:
    """The latest reminder step whose date has arrived and that was not sent yet, plus all steps now consumed."""
    sent = set(doc.get("steps_sent", []))
    arrived = [(name, off) for name, off in STEPS if due_of(doc) + timedelta(days=off) <= today and name not in sent]
    return (arrived[-1][0] if arrived else None), [n for n, _ in arrived]


def run_reminders(db: Database, today: date | None = None) -> int:
    """Send each overdue/due-soon entry its next reminder (one message, latest step only). Returns how many were sent."""
    today = today or date.today()
    sent_count = 0
    for doc in db.receivables.find({"kind": "receivable", "paid": False, "auto_remind": True}):
        if not (doc.get("email") or doc.get("phone")):
            continue
        promise = doc.get("promise_date")
        if promise and promise.date() >= today:  # respect the customer's promise
            continue
        if doc.get("claim") or doc.get("disputed"):  # waiting on the owner (claim) or the customer disagrees: do not nag
            continue
        step, consumed = due_step(doc, today)
        if not step:
            continue
        business = get_business(db, doc["business_id"])
        channels = [c for c, v in (("email", doc.get("email")), ("whatsapp", doc.get("phone"))) if v]
        dispatch(db, doc, vars(business), channels, step, doc.get("lang", "en"), today)
        db.receivables.update_one({"_id": doc["_id"]}, {"$addToSet": {"steps_sent": {"$each": consumed}}})
        log_event(db, doc["_id"], "auto_reminder", step=step)
        sent_count += 1
    return sent_count


# ---------------------------------------------------------------- customer reliability
def customer_key(doc: dict) -> str:
    digits = "".join(c for c in (doc.get("phone") or "") if c.isdigit())[-10:]
    return digits or doc["party"].strip().lower()


def customers(db: Database, business_id: str, today: date | None = None) -> list[dict]:
    """Per-customer ledger + a transparent reliability score from payment history (see `score` below)."""
    today = today or date.today()
    groups: dict[str, list[dict]] = {}
    for doc in db.receivables.find({"business_id": business_id, "kind": "receivable"}):
        groups.setdefault(customer_key(doc), []).append(doc)

    out = []
    for key, docs in groups.items():
        settled = [d for d in docs if d["paid"]]
        open_ = [d for d in docs if not d["paid"]]
        lates = []
        for d in settled:
            on = d.get("settled_on")
            lates.append(max(0, ((on.date() if isinstance(on, datetime) else on) - due_of(d)).days) if on else 0)
        avg_late = sum(lates) / len(lates) if lates else 0.0
        on_time = sum(1 for x in lates if x <= 3) / len(lates) if lates else None
        overdue_open = [d for d in open_ if days_overdue(d, today) > 0]
        # Score: start at 100, lose up to 55 for habitual lateness and up to 30 for invoices overdue right now.
        score = round(max(0, 100 - min(55, avg_late * 1.5) - min(30, len(overdue_open) * 12 + sum(min(10, days_overdue(d, today) // 15) for d in overdue_open))))
        label = "reliable" if score >= 80 else "late" if score >= 55 else "risky"
        largest_paid = max((d["amount"] for d in settled), default=0)
        outstanding = sum(outstanding_of(d) for d in open_)
        # Total credit line we'd suggest (None until they have paid at least once); `over_limit` flags exceeding it.
        limit = round(largest_paid * 1.5 * score / 100 / 1000) * 1000 if settled else None
        newest = max(docs, key=lambda d: d["created_at"])
        out.append({
            "key": key, "party": newest["party"], "phone": newest.get("phone"), "email": newest.get("email"), "invoices": len(docs),
            "outstanding": round(outstanding, 2), "overdue": round(sum(outstanding_of(d) for d in overdue_open), 2),
            "paid_total": round(sum(d["amount"] for d in settled), 2), "avg_days_late": round(avg_late, 1),
            "on_time_rate": None if on_time is None else round(on_time * 100), "score": score, "label": label, "suggested_limit": limit, "over_limit": limit is not None and outstanding > limit,
            "open_ids": [str(d["_id"]) for d in open_],
            "history": [
                {"amount": d["amount"], "due_date": due_of(d), "days_late": x}
                for d, x in sorted(zip(settled, lates), key=lambda p: due_of(p[0]), reverse=True)[:10]
            ],
        })
    return sorted(out, key=lambda c: (-c["overdue"], -c["outstanding"]))
