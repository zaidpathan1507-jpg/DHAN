"""Cash Calendar: a dated day-by-day cash projection with early crunch warnings and a rescue plan.

Method (shown to the user): start from today's cash; each future day adds the business's usual income and spending
for that weekday (90-day averages, one-off flagged expenses excluded) and subtracts bills (payables) on their due
dates. Money customers owe is NOT counted as incoming, so the line stays conservative; those invoices are instead
offered as the "rescue plan" when the line dips below the safety buffer (15 days of normal spending).
"""

from datetime import date, timedelta

from pymongo.database import Database

from app.db.session import day, get_business
from app.services import udhaar_service as u

WINDOW_DAYS = 90
BUFFER_DAYS = 15
MIN_TRANSACTIONS = 14


def cash_calendar(db: Database, business_id: str, days: int = 45, sales_pct: float = 0.0, cost_pct: float = 0.0, today: date | None = None,
                  payable_due: dict | None = None, collect: dict | None = None) -> dict:
    """`payable_due` {payable_id: new_date} and `collect` {receivable_id: (date, probability)} let the planner test a
    proposed fix: pay a bill later, or collect an invoice on a date weighted by how reliably that customer pays."""
    today = today or date.today()
    txns = list(db.transactions.find({"business_id": business_id, "txn_date": {"$lte": day(today)}}, {"amount": 1, "type": 1, "txn_date": 1, "is_anomaly": 1}))
    if len(txns) < MIN_TRANSACTIONS:
        return {"insufficient_history": True}

    business = get_business(db, business_id)
    current = float(business.opening_balance if business else 0) + sum(t["amount"] if t["type"] == "income" else -t["amount"] for t in txns)

    start = today - timedelta(days=WINDOW_DAYS)
    weekday_days = [0] * 7
    for i in range(1, WINDOW_DAYS + 1):
        weekday_days[(start + timedelta(days=i)).weekday()] += 1
    income, spend, total_spend = [0.0] * 7, [0.0] * 7, 0.0
    for t in txns:
        d = t["txn_date"].date()
        if start < d <= today and not t.get("is_anomaly"):
            (income if t["type"] == "income" else spend)[d.weekday()] += t["amount"]
            total_spend += t["amount"] if t["type"] == "expense" else 0
    income_by_wd = [income[i] / weekday_days[i] if weekday_days[i] else 0 for i in range(7)]
    spend_by_wd = [spend[i] / weekday_days[i] if weekday_days[i] else 0 for i in range(7)]
    avg_daily_spend = total_spend / WINDOW_DAYS
    buffer = round(BUFFER_DAYS * avg_daily_spend)

    open_items = [d for d in db.receivables.find({"business_id": business_id, "paid": False})]
    payables = [d for d in open_items if d["kind"] == "payable"]
    receivables = [d for d in open_items if d["kind"] == "receivable"]
    tomorrow = today + timedelta(days=1)

    series, balance = [], current
    for i in range(1, days + 1):
        d = today + timedelta(days=i)
        inc = income_by_wd[d.weekday()] * (1 + sales_pct / 100)
        exp = spend_by_wd[d.weekday()] * (1 + cost_pct / 100)
        events, bills, collected = [], 0.0, 0.0
        for p in payables:
            due_p = (payable_due or {}).get(str(p["_id"]), u.due_of(p))
            if max(due_p, tomorrow) == d:
                bills += u.outstanding_of(p)
                events.append({"type": "payable", "id": str(p["_id"]), "party": p["party"], "amount": u.outstanding_of(p), "overdue": due_p < tomorrow})
        for r in receivables:
            promise = r["promise_date"].date() if r.get("promise_date") else None
            if max(promise or u.due_of(r), tomorrow) == d:
                events.append({"type": "receivable", "id": str(r["_id"]), "party": r["party"], "amount": u.outstanding_of(r), "overdue": u.due_of(r) < tomorrow, "promised": bool(promise)})
        for r in receivables:
            when = (collect or {}).get(str(r["_id"]))
            if when and when[0] == d:
                collected += u.outstanding_of(r) * when[1]
        balance += inc - exp - bills + collected
        series.append({"date": d.isoformat(), "balance": round(balance), "events": events})

    lowest = min(series, key=lambda s: s["balance"])
    crunch = None
    first_neg = next((s for s in series if s["balance"] < 0), None)
    first_low = next((s for s in series if s["balance"] < buffer), None)
    if first_neg or first_low:
        hit = first_neg or first_low
        crunch = {
            "level": "critical" if first_neg else "warning", "date": hit["date"], "days_away": (date.fromisoformat(hit["date"]) - today).days,
            "shortfall": round(buffer - lowest["balance"]),
        }

    rescue = None
    if crunch:
        need = buffer - lowest["balance"]
        labels = {c["key"]: c["label"] for c in u.customers(db, business_id, today)}
        ranked = sorted(receivables, key=lambda r: (-u.days_overdue(r, today), -u.outstanding_of(r)))
        picked, total = [], 0.0
        for r in ranked:
            if total >= need:
                break
            picked.append({
                "id": str(r["_id"]), "party": r["party"], "amount": u.outstanding_of(r), "days_overdue": u.days_overdue(r, today),
                "label": labels.get(u.customer_key(r)), "has_contact": bool(r.get("email") or r.get("phone")),
            })
            total += u.outstanding_of(r)
        rescue = {"need": round(need), "items": picked, "covers": total >= need, "total": round(total)}

    return {
        "insufficient_history": False, "current": round(current), "buffer": buffer, "buffer_days": BUFFER_DAYS, "avg_daily_spend": round(avg_daily_spend),
        "series": series, "lowest": {"date": lowest["date"], "balance": lowest["balance"]}, "crunch": crunch, "rescue": rescue,
        "bills_total": round(sum(u.outstanding_of(p) for p in payables)), "owed_total": round(sum(u.outstanding_of(r) for r in receivables)),
        "assumptions": {"sales_pct": sales_pct, "cost_pct": cost_pct, "window_days": WINDOW_DAYS},
    }
