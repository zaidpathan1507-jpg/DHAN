"""Data tools for DHAN AI. Shared by the LLM's function-calling mode and the offline rules engine.

Every tool is scoped to one business and returns (data, block): `data` is what the model (or rules engine) reasons
over; `block` is a ready-made UI card (metrics / bars / table) so the numbers a user sees are always the real ones,
never text the model typed. Tool labels are localised (en/hi); amounts stay numeric for the UI to format.
"""

from datetime import date, timedelta

from pymongo.database import Database

from app.db.session import day, find_txns, get_business
from app.services import ai_actions, cash_calendar as cc, gst_service, udhaar_service as u
from app.services.credit_service import get_credit_readiness
from app.services.forecast_service import get_forecast
from app.services.insights_service import generate_insights

PERIODS = ["today", "yesterday", "7d", "30d", "90d", "month", "last_month", "year", "all"]
PERIOD_LABELS = {
    "today": ("today", "आज"), "yesterday": ("yesterday", "कल"), "7d": ("in the last 7 days", "पिछले 7 दिनों में"),
    "30d": ("in the last 30 days", "पिछले 30 दिनों में"), "90d": ("in the last 90 days", "पिछले 90 दिनों में"),
    "month": ("this month", "इस महीने"), "last_month": ("last month", "पिछले महीने"), "year": ("this year", "इस साल"), "all": ("overall", "अब तक"),
}


def L(lang: str, en: str, hi: str) -> str:
    return hi if lang in ("hi", "mr") else en  # ponytail: Marathi replies reuse the Hindi (Devanagari) templates; add real mr strings to upgrade


def bounds(period: str, today: date) -> tuple[date, date]:
    if period == "today":
        return today, today
    if period == "yesterday":
        return today - timedelta(days=1), today - timedelta(days=1)
    if period == "7d":
        return today - timedelta(days=6), today
    if period == "90d":
        return today - timedelta(days=89), today
    if period == "month":
        return today.replace(day=1), today
    if period == "last_month":
        last = today.replace(day=1) - timedelta(days=1)
        return last.replace(day=1), last
    if period == "year":
        return date(today.year, 1, 1), today
    if period == "all":
        return date(2000, 1, 1), today
    return today - timedelta(days=29), today  # 30d


def _label(period: str, lang: str) -> str:
    en, hi = PERIOD_LABELS.get(period, PERIOD_LABELS["30d"])
    return L(lang, en, hi)


def _range(db, bid, period, today, **extra):
    start, end = bounds(period, today)
    flt = {"business_id": bid, "txn_date": {"$gte": day(start), "$lte": day(end)}, **extra}
    return start, end, find_txns(db, flt)


def _sum(txns, kind):
    return round(sum(float(t.amount) for t in txns if t.type == kind), 2)


def _pct(cur, prev):
    return None if not prev else round((cur - prev) / prev * 100, 1)


def _metric(label, value, kind="inr", tone="neutral", hint=None):
    return {"label": label, "value": value, "kind": kind, "tone": tone, "hint": hint}


# ---------------------------------------------------------------- tools
def get_summary(db: Database, bid: str, lang: str, today: date, period: str = "30d") -> tuple[dict, dict]:
    start, end, txns = _range(db, bid, period, today)
    inc, exp = _sum(txns, "income"), _sum(txns, "expense")
    prev = None
    if period != "all":
        span = (end - start).days + 1
        p_start, p_end = start - timedelta(days=span), start - timedelta(days=1)
        pt = find_txns(db, {"business_id": bid, "txn_date": {"$gte": day(p_start), "$lte": day(p_end)}})
        prev = {"income": _sum(pt, "income"), "expenses": _sum(pt, "expense")}
    biz = get_business(db, bid)
    all_t = find_txns(db, {"business_id": bid, "txn_date": {"$lte": day(today)}})
    cash = round(float(biz.opening_balance if biz else 0) + _sum(all_t, "income") - _sum(all_t, "expense"), 2)
    ci, ce = (_pct(inc, prev["income"]), _pct(exp, prev["expenses"])) if prev else (None, None)
    data = {"period": period, "label": _label(period, "en"), "from": start.isoformat(), "to": end.isoformat(), "income": inc, "expenses": exp,
            "net": round(inc - exp, 2), "transactions": len(txns), "cash_balance_now": cash, "income_change_pct_vs_previous": ci, "expenses_change_pct_vs_previous": ce}
    hint = lambda c: None if c is None else f"{c:+.0f}% " + L(lang, "vs previous", "पिछली अवधि से")  # noqa: E731
    block = {"type": "metrics", "title": _label(period, lang).capitalize() if lang != "hi" else _label(period, lang), "items": [
        _metric(L(lang, "Income", "आमदनी"), inc, tone="gain", hint=hint(ci)),
        _metric(L(lang, "Expenses", "खर्चे"), exp, tone="loss", hint=hint(ce)),
        _metric(L(lang, "Net", "शुद्ध बचत"), round(inc - exp, 2), tone="gain" if inc >= exp else "loss"),
        _metric(L(lang, "Cash in hand", "हाथ में नकद"), cash),
    ]}
    return data, block


def get_spending_by_category(db: Database, bid: str, lang: str, today: date, period: str = "30d", type: str = "expense", limit: int = 8) -> tuple[dict, dict]:
    _, _, txns = _range(db, bid, period, today, type=type)
    totals: dict[str, float] = {}
    for t in txns:
        totals[t.category] = totals.get(t.category, 0) + float(t.amount)
    total = sum(totals.values()) or 1.0
    rows = sorted(({"label": c, "kind": "category", "value": round(v, 2), "pct": round(v / total * 100, 1)} for c, v in totals.items()), key=lambda r: -r["value"])[: max(1, min(limit, 12))]
    data = {"period": period, "type": type, "total": round(sum(totals.values()), 2), "categories": [{"category": r["label"], "amount": r["value"], "share_pct": r["pct"]} for r in rows]}
    title = L(lang, "Where the money went" if type == "expense" else "Where the money came from", "पैसा कहां गया" if type == "expense" else "पैसा कहां से आया")
    return data, {"type": "bars", "title": f"{title} · {_label(period, lang)}", "rows": rows}


def get_top_vendors(db: Database, bid: str, lang: str, today: date, period: str = "30d", type: str = "expense", limit: int = 6) -> tuple[dict, dict]:
    _, _, txns = _range(db, bid, period, today, type=type)
    totals: dict[str, float] = {}
    for t in txns:
        totals[t.vendor] = totals.get(t.vendor, 0) + float(t.amount)
    total = sum(totals.values()) or 1.0
    rows = sorted(({"label": v, "value": round(a, 2), "pct": round(a / total * 100, 1)} for v, a in totals.items()), key=lambda r: -r["value"])[: max(1, min(limit, 12))]
    data = {"period": period, "type": type, "vendors": [{"vendor": r["label"], "amount": r["value"], "share_pct": r["pct"]} for r in rows]}
    title = L(lang, "Biggest vendors" if type == "expense" else "Biggest sources of income", "सबसे बड़े विक्रेता" if type == "expense" else "आमदनी के सबसे बड़े स्रोत")
    return data, {"type": "bars", "title": f"{title} · {_label(period, lang)}", "rows": rows}


def search_transactions(db: Database, bid: str, lang: str, today: date, text: str | None = None, category: str | None = None, type: str | None = None,
                        period: str = "30d", min_amount: float | None = None, limit: int = 8) -> tuple[dict, dict]:
    extra = {k: v for k, v in (("category", category), ("type", type)) if v}
    _, _, txns = _range(db, bid, period, today, **extra)
    if text:
        txns = [t for t in txns if text.lower() in t.vendor.lower() or text.lower() in (t.description or "").lower()]
    if min_amount:
        txns = [t for t in txns if float(t.amount) >= min_amount]
    txns.sort(key=lambda t: (t.txn_date, float(t.amount)), reverse=True)
    top = txns[: max(1, min(limit, 15))]
    data = {"matches": len(txns), "total_amount": round(sum(float(t.amount) for t in txns), 2), "shown": [
        {"date": t.txn_date.isoformat(), "vendor": t.vendor, "category": t.category, "type": t.type, "amount": float(t.amount)} for t in top]}
    cols = [{"key": "date", "label": L(lang, "Date", "तारीख"), "kind": "date"}, {"key": "vendor", "label": L(lang, "Vendor", "विक्रेता")},
            {"key": "category", "label": L(lang, "Category", "श्रेणी"), "kind": "category"}, {"key": "amount", "label": L(lang, "Amount", "राशि"), "kind": "inr", "align": "right", "signed": True}]
    rows = [{"date": t.txn_date.isoformat(), "vendor": t.vendor, "category": t.category, "amount": float(t.amount) * (1 if t.type == "income" else -1)} for t in top]
    return data, {"type": "table", "title": L(lang, "Matching transactions", "मिलते-जुलते लेन-देन") + f" · {len(txns)}", "columns": cols, "rows": rows}


def get_receivables(db: Database, bid: str, lang: str, today: date, kind: str = "receivable") -> tuple[dict, dict]:
    docs = list(db.receivables.find({"business_id": bid, "kind": kind, "paid": False}))
    items = sorted(({"party": d["party"], "outstanding": u.outstanding_of(d), "days_overdue": u.days_overdue(d, today), "due": u.due_of(d).isoformat(),
                     "promised": d["promise_date"].date().isoformat() if d.get("promise_date") else None, "claims_paid": bool(d.get("claim"))} for d in docs),
                   key=lambda i: (-i["days_overdue"], -i["outstanding"]))
    total = round(sum(i["outstanding"] for i in items), 2)
    overdue = round(sum(i["outstanding"] for i in items if i["days_overdue"]), 2)
    claims = sum(1 for i in items if i["claims_paid"])
    data = {"kind": kind, "open_count": len(items), "total_outstanding": total, "overdue": overdue, "claims_waiting_confirmation": claims, "top": items[:6]}
    cols = [{"key": "party", "label": L(lang, "Who", "कौन")}, {"key": "late", "label": L(lang, "Late", "देरी"), "kind": "days"}, {"key": "amount", "label": L(lang, "Amount", "राशि"), "kind": "inr", "align": "right"}]
    block = {"type": "metrics", "title": L(lang, "Money owed to you" if kind == "receivable" else "Bills you owe", "आपको मिलना है" if kind == "receivable" else "आपको देना है"), "items": [
        _metric(L(lang, "Outstanding", "बाकी"), total), _metric(L(lang, "Overdue", "देर से"), overdue, tone="loss" if overdue else "neutral"),
        _metric(L(lang, "Open invoices", "खुले इनवॉइस"), len(items), kind="count")],
        "table": {"columns": cols, "rows": [{"party": i["party"], "late": i["days_overdue"], "amount": i["outstanding"]} for i in items[:5]]}}
    return data, block


def get_forecast_tool(db: Database, bid: str, lang: str, today: date) -> tuple[dict, dict | None]:
    f = get_forecast(db, bid)
    if f.get("insufficient_history"):
        return {"available": False, "reason": f.get("message")}, None
    data = {"status": f["status"], "current_cash": f["current_cash_balance"], "expected_closing_balance_30d": f["expected_closing_balance"], "best_case": f["best_case"], "worst_case": f["worst_case"]}
    tone = {"HEALTHY": "gain", "WATCH": "warn", "AT RISK": "loss"}[f["status"]]
    return data, {"type": "metrics", "title": L(lang, "30-day forecast", "30 दिन का पूर्वानुमान"), "items": [
        _metric(L(lang, "Expected", "अनुमानित"), f["expected_closing_balance"], tone=tone), _metric(L(lang, "Worst case", "सबसे बुरा हाल"), f["worst_case"]),
        _metric(L(lang, "Best case", "सबसे अच्छा हाल"), f["best_case"], tone="gain")]}


def get_cash_calendar_tool(db: Database, bid: str, lang: str, today: date, days: int = 45) -> tuple[dict, dict | None]:
    c = cc.cash_calendar(db, bid, max(7, min(days, 90)), today=today)
    if c.get("insufficient_history"):
        return {"available": False}, None
    data = {"cash_now": c["current"], "safety_buffer": c["buffer"], "lowest_balance": c["lowest"]["balance"], "lowest_on": c["lowest"]["date"], "crunch": c["crunch"],
            "bills_due_total": c["bills_total"], "owed_by_customers": c["owed_total"], "rescue_plan": c["rescue"]}
    tone = "loss" if c["crunch"] and c["crunch"]["level"] == "critical" else "warn" if c["crunch"] else "gain"
    return data, {"type": "metrics", "title": L(lang, f"Cash calendar · next {days} days", f"कैश कैलेंडर · अगले {days} दिन"), "items": [
        _metric(L(lang, "Lowest point", "सबसे निचला स्तर"), c["lowest"]["balance"], tone=tone, hint=c["lowest"]["date"]),
        _metric(L(lang, "Safety buffer", "सुरक्षा बफ़र"), c["buffer"]), _metric(L(lang, "Bills due", "देय बिल"), c["bills_total"])]}


def get_credit_tool(db: Database, bid: str, lang: str, today: date) -> tuple[dict, dict | None]:
    c = get_credit_readiness(db, bid)
    if c.get("insufficient_history"):
        return {"available": False, "reason": c.get("message")}, None
    data = {"score": c["score"], "band": c["band"], "components": {x["label"]: x["score"] for x in c["components"]}, "biggest_opportunity": c["biggest_opportunity"]}
    rows = [{"label": x["label"], "value": x["score"], "pct": x["score"], "unit": "score"} for x in sorted(c["components"], key=lambda x: x["score"])]
    return data, {"type": "bars", "title": L(lang, f"Credit readiness {c['score']:.0f}/100 ({c['band'].title()})", f"क्रेडिट तैयारी {c['score']:.0f}/100"), "rows": rows}


def get_customer_reliability(db: Database, bid: str, lang: str, today: date, limit: int = 6) -> tuple[dict, dict | None]:
    cs = u.customers(db, bid, today)[: max(1, min(limit, 10))]
    data = {"customers": [{"customer": c["party"], "score": c["score"], "label": c["label"], "avg_days_late": c["avg_days_late"], "outstanding": c["outstanding"], "overdue": c["overdue"]} for c in cs]}
    if not cs:
        return data, None
    cols = [{"key": "party", "label": L(lang, "Customer", "ग्राहक")}, {"key": "score", "label": L(lang, "Score", "स्कोर"), "kind": "count"}, {"key": "amount", "label": L(lang, "Owes", "बाकी"), "kind": "inr", "align": "right"}]
    return data, {"type": "table", "title": L(lang, "Customer reliability", "ग्राहकों का भरोसा"), "columns": cols, "rows": [{"party": c["party"], "score": c["score"], "amount": c["outstanding"]} for c in cs]}


def propose_cash_plan(db: Database, bid: str, lang: str, today: date) -> tuple[dict, dict | None]:
    """Proposes (never executes) concrete steps to protect cash; the owner approves each one in the UI."""
    p = ai_actions.plan(db, bid, lang, today)
    summary = [{"type": a["type"], **{k: v for k, v in a["params"].items() if k in ("parties", "party", "total", "amount", "from", "to")}} for a in p["actions"]]
    data = {"proposed_actions": summary, "impact": p["impact"], "note": "Nothing has been done yet. The owner must approve each action."}
    if not p["actions"]:
        return data, None
    return data, {"type": "plan", "title": L(lang, "Proposed plan", "सुझाई गई योजना"), "impact": p["impact"], "actions": p["actions"]}


def get_gst_tool(db: Database, bid: str, lang: str, today: date, months: int = 3, rate: int = 18) -> tuple[dict, dict | None]:
    g = gst_service.gst_summary(db, bid, max(1, min(months, 6)), rate, True, today)
    f = g["filing"]
    data = {"assumptions": g["assumptions"], "filing": f, "totals": g["totals"], "itc_you_can_claim_with_invoices": g["totals"]["itc_missing"], "top_missing_invoices": g["missing_invoices"][:3], "note": "Estimates, not a filing. Suggest a CA to confirm."}
    return data, {"type": "metrics", "title": L(lang, f"GST estimate · {f['period']}", f"GST अनुमान · {f['period']}"), "items": [
        _metric(L(lang, "Net payable", "शुद्ध देय"), f["estimated_net_payable"] or 0, tone="warn"), _metric(L(lang, "ITC unclaimed", "बिना दावे का ITC"), g["totals"]["itc_missing"], tone="gain"),
        _metric(L(lang, "GSTR-3B in (days)", "GSTR-3B में (दिन)"), f["days_to_gstr3b"], kind="count")]}


def get_insights_tool(db: Database, bid: str, lang: str, today: date) -> tuple[dict, None]:
    ins = generate_insights(db, bid)[:6]
    return {"insights": [{"title": i["title"], "headline": i["headline"], "detail": i["body"]} for i in ins]}, None


TOOLS = {
    "get_summary": get_summary, "get_spending_by_category": get_spending_by_category, "get_top_vendors": get_top_vendors,
    "search_transactions": search_transactions, "get_receivables": get_receivables, "get_forecast": get_forecast_tool,
    "get_gst_summary": get_gst_tool, "get_cash_calendar": get_cash_calendar_tool, "propose_cash_plan": propose_cash_plan, "get_credit_readiness": get_credit_tool, "get_customer_reliability": get_customer_reliability,
    "get_insights": get_insights_tool,
}


def _fn(name, description, properties=None, required=()):
    return {"type": "function", "function": {"name": name, "description": description, "parameters": {"type": "object", "properties": properties or {}, "required": list(required)}}}


_PERIOD = {"type": "string", "enum": PERIODS, "description": "Time window. Default 30d."}
_TYPE = {"type": "string", "enum": ["expense", "income"]}
SCHEMAS = [
    _fn("get_summary", "Income, expenses, net and cash balance for a period, compared with the previous equal period.", {"period": _PERIOD}),
    _fn("get_spending_by_category", "Spending (or income) broken down by category for a period.", {"period": _PERIOD, "type": _TYPE, "limit": {"type": "integer"}}),
    _fn("get_top_vendors", "Biggest vendors by spend (or biggest income sources) for a period.", {"period": _PERIOD, "type": _TYPE, "limit": {"type": "integer"}}),
    _fn("search_transactions", "Find individual transactions by vendor/description text, category, type, minimum amount and period.",
        {"text": {"type": "string"}, "category": {"type": "string"}, "type": _TYPE, "period": _PERIOD, "min_amount": {"type": "number"}, "limit": {"type": "integer"}}),
    _fn("get_receivables", "Open udhaar: money customers owe (receivable) or bills the business owes (payable), with overdue amounts.", {"kind": {"type": "string", "enum": ["receivable", "payable"]}}),
    _fn("get_forecast", "30-day cash forecast: expected, best and worst closing balance and health status."),
    _fn("get_cash_calendar", "Day-by-day cash projection: lowest point, safety buffer, any predicted cash crunch date and a rescue plan.", {"days": {"type": "integer"}}),
    _fn("propose_cash_plan", "Use when the user asks what to do about tight cash, overdue invoices or bills, or wants a plan or fix. Proposes concrete actions the user can approve with one tap. It never executes anything."),
    _fn("get_gst_summary", "Estimated GST: net payable for the filing period, input tax credit, missing supplier invoices, and the GSTR-1/GSTR-3B due dates.", {"months": {"type": "integer"}, "rate": {"type": "integer", "enum": [0, 5, 12, 18, 28]}}),
    _fn("get_credit_readiness", "The business's indicative credit-readiness score and its components."),
    _fn("get_customer_reliability", "How reliably each customer pays: score, average days late, amount outstanding.", {"limit": {"type": "integer"}}),
    _fn("get_insights", "Automatically detected spending changes and unusual expenses."),
]


def run_tool(db: Database, bid: str, lang: str, name: str, args: dict, today: date | None = None) -> tuple[dict, dict | None]:
    fn = TOOLS.get(name)
    if not fn:
        return {"error": f"unknown tool {name}"}, None
    params = fn.__code__.co_varnames[: fn.__code__.co_argcount]
    # Llama-family models sometimes send null or stringified numbers; normalise before calling.
    allowed = {k: v for k, v in (args or {}).items() if k in params and k not in ("db", "bid", "lang", "today") and v not in (None, "")}
    for key, cast in (("limit", int), ("days", int), ("min_amount", float)):
        if key in allowed:
            try:
                allowed[key] = cast(allowed[key])
            except (TypeError, ValueError):
                del allowed[key]
    if allowed.get("period") not in (None, *PERIODS):
        allowed["period"] = "30d"
    try:
        return fn(db, bid, lang, today or date.today(), **allowed)
    except TypeError as exc:
        return {"error": str(exc)}, None
