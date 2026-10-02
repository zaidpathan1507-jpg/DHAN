"""GST helper: ESTIMATES monthly output tax, input tax credit (ITC) and net payable from the books, and shows what ITC
the business is leaving on the table because supplier invoices lack a GSTIN.

DHAN does not store per-line tax, so the estimate rests on stated assumptions the user can change: the sales rate and
whether amounts include GST. Fuel, food, wages and tax/fee payments never carry ITC. It is a planning aid, not a filing.
"""

from datetime import date, timedelta

from pymongo.database import Database

from app.db.session import day, find_txns

RATES = (0, 5, 12, 18, 28)
ITC_RATE = {"Raw Material & Stock": 18, "Utilities": 18, "Rent": 18, "Marketing": 18, "Repairs & Maintenance": 18, "Others": 18}  # assumed supplier rate
NO_ITC = {"Food & Refreshments", "Transport & Fuel", "Salaries & Wages", "Taxes & Fees"}  # blocked / outside GST / not a supply
OUTPUT_CATEGORIES = {"Sales Revenue", "Services Rendered"}
FOREIGN_PREFIXES = ("mongodb", "google", "meta ", "twilio", "firebase", "datadog", "saas tools")  # billed from abroad: no GSTIN to collect (reverse charge, a CA topic)


def _month_key(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def _shift(first: date, months: int) -> date:
    y, m = divmod(first.year * 12 + first.month - 1 + months, 12)
    return date(y, m + 1, 1)


def _tax(amount: float, rate: float, inclusive: bool) -> float:
    return amount * rate / (100 + rate) if inclusive else amount * rate / 100


def gst_summary(db: Database, bid: str, months: int = 6, rate: int = 18, inclusive: bool = True, today: date | None = None) -> dict:
    today = today or date.today()
    rate = rate if rate in RATES else 18
    first = _shift(today.replace(day=1), -(max(1, min(months, 12)) - 1))
    txns = find_txns(db, {"business_id": bid, "txn_date": {"$gte": day(first), "$lte": day(today)}})

    rows = {}
    for i in range(max(1, min(months, 12))):
        k = _month_key(_shift(first, i))
        rows[k] = {"month": k, "sales": 0.0, "output_gst": 0.0, "purchases": 0.0, "itc": 0.0, "itc_missing": 0.0, "paid": 0.0}
    missing: dict[str, dict] = {}

    for t in txns:
        amount, k = float(t.amount), _month_key(t.txn_date)
        if t.type == "income":
            if t.category in OUTPUT_CATEGORIES and k in rows:
                rows[k]["sales"] += amount
                rows[k]["output_gst"] += _tax(amount, rate, inclusive)
            continue
        if t.vendor.lower().startswith("gst payment"):  # a payment made in month m settles month m-1
            pk = _month_key(_shift(t.txn_date.replace(day=1), -1))
            if pk in rows:
                rows[pk]["paid"] += amount
            continue
        cat_rate = ITC_RATE.get(t.category)
        if t.category in NO_ITC or not cat_rate or k not in rows or t.vendor.lower().startswith(FOREIGN_PREFIXES):
            continue
        itc = _tax(amount, cat_rate, True)
        if t.gstin:
            rows[k]["purchases"] += amount
            rows[k]["itc"] += itc
        else:
            rows[k]["itc_missing"] += itc
            m = missing.setdefault(t.vendor, {"vendor": t.vendor, "category": t.category, "amount": 0.0, "itc_potential": 0.0, "count": 0})
            m["amount"] += amount
            m["itc_potential"] += itc
            m["count"] += 1

    series = []
    for r in rows.values():
        net = r["output_gst"] - r["itc"]
        series.append({**{k: round(v) if k != "month" else v for k, v in r.items()}, "net_payable": round(net)})

    # Filing calendar for monthly filers: the previous month is due on the 11th (GSTR-1) and the 20th (GSTR-3B).
    period_start = _shift(today.replace(day=1), -1) if today.day <= 20 else today.replace(day=1)
    due_month = _shift(period_start, 1)
    g1, g3b = due_month.replace(day=11), due_month.replace(day=20)
    period = next((s for s in series if s["month"] == _month_key(period_start)), None)
    filing = {
        "period": _month_key(period_start), "gstr1_due": g1.isoformat(), "gstr3b_due": g3b.isoformat(), "days_to_gstr1": (g1 - today).days, "days_to_gstr3b": (g3b - today).days,
        "estimated_net_payable": period["net_payable"] if period else None, "paid_so_far": period["paid"] if period else 0,
    }
    total_missing = sum(m["itc_potential"] for m in missing.values())
    return {
        "assumptions": {"rate": rate, "inclusive": inclusive, "months": len(series)},
        "months": series, "filing": filing,
        "totals": {"sales": sum(s["sales"] for s in series), "output_gst": sum(s["output_gst"] for s in series), "itc": sum(s["itc"] for s in series), "net_payable": sum(s["net_payable"] for s in series),
                   "itc_missing": round(total_missing), "paid": sum(s["paid"] for s in series)},
        "missing_invoices": [{**m, "amount": round(m["amount"]), "itc_potential": round(m["itc_potential"])} for m in sorted(missing.values(), key=lambda m: -m["itc_potential"])[:8]],
    }


def register(db: Database, bid: str, month: str, rate: int = 18, inclusive: bool = True) -> dict:
    """Month detail for a CA: sales total and a purchase register (supplier GSTIN, amount, estimated ITC)."""
    y, m = (int(x) for x in month.split("-"))
    start = date(y, m, 1)
    end = _shift(start, 1) - timedelta(days=1)
    txns = find_txns(db, {"business_id": bid, "txn_date": {"$gte": day(start), "$lte": day(end)}})
    sales = sum(float(t.amount) for t in txns if t.type == "income" and t.category in OUTPUT_CATEGORIES)
    purchases = [
        {"date": t.txn_date.isoformat(), "vendor": t.vendor, "gstin": t.gstin or "", "category": t.category, "amount": float(t.amount), "itc_estimate": round(_tax(float(t.amount), ITC_RATE[t.category], True)) if t.gstin else 0}
        for t in sorted(txns, key=lambda t: t.txn_date) if t.type == "expense" and t.category in ITC_RATE and t.category not in NO_ITC
    ]
    return {"month": month, "sales": round(sales), "output_gst": round(_tax(sales, rate if rate in RATES else 18, inclusive)), "purchases": purchases}
