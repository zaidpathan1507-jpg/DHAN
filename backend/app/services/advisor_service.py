"""Profit Coach: reads the books like a CA would and says where the money is leaking and how to earn more.

Every recommendation is a rule over the owner's own numbers (no model invents a figure): a code, the evidence
(params), and a conservative monthly rupee impact. The UI turns codes into plain-language advice in en/hi/mr.
Benchmarks are rule-of-thumb shares of revenue, not audited industry data, and the UI says so. Impact assumptions
are stated next to each number (e.g. "negotiating saves ~3%").
"""

from collections import defaultdict
from datetime import date, timedelta
from statistics import median

from pymongo.database import Database

from app.db.session import day, find_txns, get_business
from app.services import gst_service, udhaar_service as u

WINDOW = 90  # days analysed; compared with the 90 days before
MONTHS = WINDOW / 30
CARRY_RATE = 0.18  # assumed annual cost of money tied up in unpaid invoices
NEGOTIATE = 0.03  # assumed saving from renegotiating / second-sourcing a big vendor
CHURN_KEPT = 0.75  # share of a price rise that survives some customer loss
TAX_SET_ASIDE = 0.25  # indicative blended rate to park aside from profit

BENCH = {  # expected share of revenue, rule of thumb
    "default": {"Raw Material & Stock": 35, "Salaries & Wages": 20, "Rent": 8, "Utilities": 4, "Transport & Fuel": 5, "Food & Refreshments": 2, "Marketing": 8, "Repairs & Maintenance": 2, "Others": 5},
    "retail": {"Raw Material & Stock": 62, "Salaries & Wages": 8, "Rent": 6, "Utilities": 3, "Transport & Fuel": 3, "Food & Refreshments": 1, "Marketing": 4, "Repairs & Maintenance": 1, "Others": 4},
    "services": {"Raw Material & Stock": 15, "Salaries & Wages": 30, "Rent": 6, "Utilities": 6, "Transport & Fuel": 4, "Food & Refreshments": 2, "Marketing": 12, "Repairs & Maintenance": 2, "Others": 5},
    "manufacturing": {"Raw Material & Stock": 50, "Salaries & Wages": 14, "Rent": 5, "Utilities": 6, "Transport & Fuel": 4, "Food & Refreshments": 1, "Marketing": 3, "Repairs & Maintenance": 4, "Others": 4},
    "food": {"Raw Material & Stock": 38, "Salaries & Wages": 18, "Rent": 10, "Utilities": 6, "Transport & Fuel": 2, "Food & Refreshments": 2, "Marketing": 4, "Repairs & Maintenance": 3, "Others": 4},
}
STEADY = {"Rent", "Salaries & Wages", "Taxes & Fees"}  # not "price creep" candidates
PRICE_CATS = {"Raw Material & Stock", "Utilities", "Transport & Fuel", "Repairs & Maintenance"}
SUBS_CATS = {"Utilities", "Marketing", "Others"}
TITLES = {  # short English / Hindi labels for DHAN AI's text answers (the app page has full copy)
    "cost_over": ("Cut {category} spend", "{category} खर्च घटाएं"), "vendor_creep": ("{vendor} got more expensive", "{vendor} महंगा हो गया"),
    "vendor_dependence": ("Too dependent on {vendor}", "{vendor} पर बहुत निर्भरता"), "customer_concentration": ("{name} is a big share of your income", "{name} आपकी आमदनी का बड़ा हिस्सा है"),
    "collect": ("Collect overdue invoices", "बकाया इनवॉइस वसूलें"), "price_rise": ("Raise prices by 3%", "दाम 3% बढ़ाएं"),
    "subscriptions": ("Audit recurring charges", "बार-बार लगने वाले चार्ज जांचें"), "marketing_roi": ("Marketing is growing faster than sales", "मार्केटिंग बिक्री से तेज़ बढ़ रही है"),
    "itc": ("Claim missing input tax credit", "छूटा हुआ इनपुट टैक्स क्रेडिट लें"), "spike": ("{category} spend jumped", "{category} खर्च अचानक बढ़ा"),
    "runway": ("Build a cash cushion", "कैश बफ़र बनाएं"), "tax_aside": ("Set aside money for tax", "टैक्स के लिए पैसा अलग रखें"),
}


def bench_for(business_type: str) -> dict:
    t = (business_type or "").lower()
    key = "retail" if any(w in t for w in ("retail", "trading", "wholesale", "shop")) else "services" if "service" in t else "manufacturing" if "manufact" in t else "food" if ("food" in t or "bever" in t) else "default"
    return BENCH[key]


def _by(txns, attr):
    out = defaultdict(float)
    for t in txns:
        out[getattr(t, attr)] += float(t.amount)
    return out


def _pct(a, b):
    return None if not b else round((a - b) / b * 100, 1)


def _clamp(x, lo=0.0, hi=20.0):
    return max(lo, min(hi, x))


def _next_advance_tax(today: date) -> date:
    for m, d in ((6, 15), (9, 15), (12, 15)):
        if date(today.year, m, d) >= today:
            return date(today.year, m, d)
    return date(today.year + 1, 3, 15) if today > date(today.year, 3, 15) else date(today.year, 3, 15)


def calendar(today: date) -> list[dict]:
    """Next filing/payment dates a small business owner must not miss (monthly GST filer assumed)."""
    out = []
    for code, d in (("gstr1", 11), ("tds", 7), ("gstr3b", 20)):
        due = date(today.year, today.month, d)
        if due < today:
            due = date(today.year + (today.month == 12), today.month % 12 + 1, d)
        out.append({"code": code, "date": due.isoformat(), "days": (due - today).days})
    adv = _next_advance_tax(today)
    out.append({"code": "advance_tax", "date": adv.isoformat(), "days": (adv - today).days})
    return sorted(out, key=lambda x: x["days"])


def analyze(db: Database, bid: str, today: date | None = None) -> dict:
    today = today or date.today()
    biz = get_business(db, bid)
    start, pstart = today - timedelta(days=WINDOW - 1), today - timedelta(days=2 * WINDOW - 1)
    all_txns = find_txns(db, {"business_id": bid})
    real = [t for t in all_txns if not t.vendor.lower().startswith("gst payment")]  # GST paid is a pass-through, not a business cost
    cur = [t for t in real if t.txn_date >= start]
    prev = [t for t in real if pstart <= t.txn_date < start]
    first = min((t.txn_date for t in all_txns), default=today)
    rev = sum(float(t.amount) for t in cur if t.type == "income")
    exp = sum(float(t.amount) for t in cur if t.type == "expense")
    if (today - first).days < 21 or rev <= 0:
        return {"insufficient": True, "days_of_data": (today - first).days}

    prev_rev = sum(float(t.amount) for t in prev if t.type == "income")
    prev_exp = sum(float(t.amount) for t in prev if t.type == "expense")
    profit = rev - exp
    margin = profit / rev * 100
    rev_m, exp_m, profit_m = rev / MONTHS, exp / MONTHS, profit / MONTHS
    growth, exp_growth = _pct(rev, prev_rev), _pct(exp, prev_exp)

    # ---- six-month P&L
    months = []
    for back in range(5, -1, -1):
        y, m = divmod(today.year * 12 + today.month - 1 - back, 12)
        key = f"{y}-{m + 1:02d}"
        rows = [t for t in real if (t.txn_date.year, t.txn_date.month) == (y, m + 1)]
        r = sum(float(t.amount) for t in rows if t.type == "income")
        e = sum(float(t.amount) for t in rows if t.type == "expense")
        months.append({"month": key, "revenue": round(r), "expenses": round(e), "profit": round(r - e)})

    exp_txns = [t for t in cur if t.type == "expense"]
    inc_txns = [t for t in cur if t.type == "income"]
    cat_cur, cat_prev = _by(exp_txns, "category"), _by([t for t in prev if t.type == "expense"], "category")
    bench = bench_for(biz.business_type if biz else "")
    structure = []
    for cat, amt in sorted(cat_cur.items(), key=lambda kv: -kv[1]):
        share = amt / rev * 100
        b = bench.get(cat)
        structure.append({"category": cat, "amount": round(amt), "share_of_revenue": round(share, 1), "benchmark": b, "status": None if b is None else "over" if share > b + 3 else "under" if share < b - 3 else "ok",
                          "change_pct": _pct(amt, cat_prev.get(cat, 0))})

    recs: list[dict] = []

    def add(code, area, impact, priority=None, **params):
        recs.append({"code": code, "area": area, "impact": None if impact is None else round(impact), "priority": priority, "params": params})

    # 1. categories running above the rule-of-thumb share of revenue (recover half the excess)
    for s in [s for s in structure if s["status"] == "over"][:3]:
        excess = (s["share_of_revenue"] - s["benchmark"]) / 100 * rev
        add("cost_over", "cost", excess * 0.5 / MONTHS, category=s["category"], share=s["share_of_revenue"], benchmark=s["benchmark"], amount=s["amount"], excess=round(excess / MONTHS))

    # 2. vendors whose typical bill is creeping up (last 45 days vs the 45 before)
    mid = today - timedelta(days=45)
    for vendor in {t.vendor for t in exp_txns if t.category in PRICE_CATS}:
        recent = [float(t.amount) for t in exp_txns if t.vendor == vendor and t.txn_date >= mid]
        older = [float(t.amount) for t in exp_txns if t.vendor == vendor and t.txn_date < mid]
        if len(recent) >= 3 and len(older) >= 3:
            a_new, a_old = sum(recent) / len(recent), sum(older) / len(older)
            if a_new > a_old * 1.15:
                add("vendor_creep", "cost", (a_new - a_old) * len(recent) / 1.5, vendor=vendor, old=round(a_old), new=round(a_new), pct=round((a_new / a_old - 1) * 100))

    # 3. one supplier carrying most of a big category
    for cat in ("Raw Material & Stock", "Marketing", "Utilities"):
        rows = [t for t in exp_txns if t.category == cat]
        total = sum(float(t.amount) for t in rows)
        if total >= exp * 0.1 and rows:
            v, amt = max(_by(rows, "vendor").items(), key=lambda kv: kv[1])
            if amt / total >= 0.6 and len({t.vendor for t in rows}) > 1:
                add("vendor_dependence", "risk", amt * NEGOTIATE / MONTHS, vendor=v, category=cat, share=round(amt / total * 100), amount=round(amt))

    # 4. one customer carrying the income
    income_by = _by(inc_txns, "vendor")
    if len(income_by) >= 2:
        name, amt = max(income_by.items(), key=lambda kv: kv[1])
        if amt / rev > 0.3:
            add("customer_concentration", "revenue", None, "high" if amt / rev > 0.45 else "medium", name=name, share=round(amt / rev * 100))

    # 5. money stuck in unpaid invoices
    open_r = [d for d in db.receivables.find({"business_id": bid, "kind": "receivable", "paid": False})]
    overdue = [d for d in open_r if u.days_overdue(d, today) > 0]
    overdue_amt = sum(u.outstanding_of(d) for d in overdue)
    total_open = sum(u.outstanding_of(d) for d in open_r)
    if overdue_amt > 0:
        worst = max(overdue, key=lambda d: u.days_overdue(d, today))
        add("collect", "cash", overdue_amt * CARRY_RATE / 12, amount=round(overdue_amt), count=len(overdue), party=worst["party"].split(" – ")[0], days=u.days_overdue(worst, today), total_open=round(total_open))

    # 6. a small price rise when margins are thin
    if margin < 20:
        add("price_rise", "revenue", rev_m * 0.03 * CHURN_KEPT, margin=round(margin, 1), gain=round(rev_m * 0.03 * CHURN_KEPT))

    # 7. recurring same-amount charges (subscriptions)
    subs = []
    for vendor in {t.vendor for t in exp_txns if t.category in SUBS_CATS}:
        amts = [float(t.amount) for t in exp_txns if t.vendor == vendor]
        if len(amts) >= 3 and max(amts) <= min(amts) * 1.03:
            subs.append((vendor, median(amts), len(amts)))
    sub_month = sum(a * n / MONTHS for _, a, n in subs)
    if subs and sub_month >= exp_m * 0.01:
        add("subscriptions", "cost", sub_month * 0.1, count=len(subs), monthly=round(sub_month), names=", ".join(v for v, _, _ in sorted(subs, key=lambda x: -x[1])[:3]))

    # 8. marketing growing faster than sales
    mk_cur, mk_prev = cat_cur.get("Marketing", 0), cat_prev.get("Marketing", 0)
    mk_growth = _pct(mk_cur, mk_prev)
    if mk_growth is not None and growth is not None and mk_cur / rev > 0.08 and mk_growth > growth + 15:
        add("marketing_roi", "cost", mk_cur * 0.2 / MONTHS, marketing_growth=mk_growth, revenue_growth=growth, share=round(mk_cur / rev * 100, 1))

    # 9. input tax credit left on the table
    try:
        g = gst_service.gst_summary(db, bid, 6, 18, True, today)
        if g["totals"]["itc_missing"] >= 1000:
            add("itc", "tax", g["totals"]["itc_missing"] / 6, amount=g["totals"]["itc_missing"], suppliers=len(g["missing_invoices"]))
    except Exception:  # advice must never fail because GST estimation did
        pass

    # 10. a category that jumped in the last 30 days
    last30 = _by([t for t in exp_txns if t.txn_date > today - timedelta(days=30)], "category")
    earlier = _by([t for t in exp_txns if t.txn_date <= today - timedelta(days=30)], "category")
    for cat, a in sorted(last30.items(), key=lambda kv: -kv[1]):
        base = earlier.get(cat, 0) / 2
        if cat != "Taxes & Fees" and base > 0 and a > base * 1.5 and (a - base) >= exp_m * 0.05:
            add("spike", "cost", (a - base) * 0.5, category=cat, last30=round(a), usual=round(base))
            break

    # 11. cash cushion
    cash = (biz.opening_balance if biz else 0) + sum(float(t.amount) * (1 if t.type == "income" else -1) for t in all_txns)
    runway = cash / exp_m if exp_m else None
    if runway is not None and runway < 2:
        add("runway", "cash", None, "high" if runway < 1 else "medium", cash=round(cash), months=round(max(runway, 0), 1))

    # 12. tax planning
    if profit > 0:
        adv = _next_advance_tax(today)
        add("tax_aside", "tax", None, "low", profit=round(profit), set_aside=round(profit * TAX_SET_ASIDE), date=adv.isoformat(), days=(adv - today).days)

    for r in recs:
        if r["priority"] is None:
            ratio = (r["impact"] or 0) / rev_m
            r["priority"] = "high" if ratio >= 0.02 else "medium" if ratio >= 0.007 else "low"
    order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: (order[r["priority"]], -(r["impact"] or 0)))
    for i, r in enumerate(recs):
        r["id"] = f"{r['code']}-{i}"
    potential = sum(r["impact"] or 0 for r in recs)

    # ---- health score: five parts, 20 points each
    overdue_ratio = overdue_amt / total_open if total_open else 0
    factors = [
        {"key": "margin", "score": round(_clamp(margin / 25 * 20)), "value": round(margin, 1)},
        {"key": "growth", "score": round(_clamp(((growth or 0) + 10) / 20 * 20)), "value": growth},
        {"key": "cost", "score": round(_clamp(20 - max(0, ((exp_growth or 0) - (growth or 0))) / 20 * 20)), "value": exp_growth},
        {"key": "collections", "score": round(_clamp(20 * (1 - overdue_ratio))), "value": round(overdue_ratio * 100)},
        {"key": "runway", "score": round(_clamp((runway or 0) / 3 * 20)), "value": None if runway is None else round(runway, 1)},
    ]
    score = sum(f["score"] for f in factors)

    # ---- break-even (fixed = salaries, rent, utilities; the rest moves with sales)
    fixed = sum(cat_cur.get(c, 0) for c in ("Salaries & Wages", "Rent", "Utilities")) / MONTHS
    variable = exp_m - fixed
    cm = 1 - variable / rev_m if rev_m else 0
    break_even = {"fixed_monthly": round(fixed), "contribution_pct": round(cm * 100, 1), "revenue_needed": round(fixed / cm) if cm > 0.05 else None, "cushion_pct": round((1 - (fixed / cm) / rev_m) * 100, 1) if cm > 0.05 else None}

    return {
        "insufficient": False, "window_days": WINDOW, "business_type": biz.business_type if biz else None,
        "pnl": {"revenue": round(rev), "expenses": round(exp), "profit": round(profit), "margin": round(margin, 1), "revenue_growth": growth, "expense_growth": exp_growth,
                "revenue_monthly": round(rev_m), "expenses_monthly": round(exp_m), "profit_monthly": round(profit_m)},
        "months": months, "structure": structure, "health": {"score": score, "label": "strong" if score >= 75 else "steady" if score >= 50 else "needs_work", "factors": factors},
        "recommendations": recs, "potential_monthly": round(potential), "potential_margin_pts": round(potential / rev_m * 100, 1), "break_even": break_even, "calendar": calendar(today),
        "assumptions": {"negotiate_pct": NEGOTIATE * 100, "carry_rate_pct": CARRY_RATE * 100, "tax_set_aside_pct": TAX_SET_ASIDE * 100, "churn_kept_pct": CHURN_KEPT * 100},
    }


def title(rec: dict, lang: str) -> str:
    en, hi = TITLES[rec["code"]]
    return (hi if lang in ("hi", "mr") else en).format(**{k: v for k, v in rec["params"].items() if isinstance(v, (str, int, float))})


def note(db: Database, bid: str, lang: str) -> dict:
    """An optional written summary in the CA's voice. Groq writes it from the computed findings only; with no key the UI composes its own sentence."""
    from app.core.config import get_settings

    a = analyze(db, bid)
    if a.get("insufficient") or not get_settings().groq_api_key:
        return {"mode": "rules", "text": None}
    from app.services import dhan_ai

    facts = {"profit_90d": a["pnl"]["profit"], "margin_pct": a["pnl"]["margin"], "health_score": a["health"]["score"], "potential_monthly_gain": a["potential_monthly"],
             "top_findings": [{"title": title(r, "en"), "monthly_impact": r["impact"], **{k: v for k, v in r["params"].items() if isinstance(v, (str, int, float))}} for r in a["recommendations"][:5]]}
    try:
        lang_name = {"hi": "Hindi", "mr": "Marathi"}.get(lang, "English")
        msg = dhan_ai._chat([{"role": "system", "content": f"You are DHAN AI acting as a friendly chartered accountant for a small Indian business owner. In {lang_name}, write 3-4 plain sentences: how the business is doing and the two or three changes that would improve profit most. Use ONLY the numbers given, exactly. No lists, no markdown, no emoji. Do not promise outcomes."},
                             {"role": "user", "content": str(facts)}], with_tools=False)
        return {"mode": "groq", "text": (msg.get("content") or "").strip() or None}
    except Exception:
        return {"mode": "rules", "text": None}
