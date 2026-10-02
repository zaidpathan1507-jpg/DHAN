from datetime import date, timedelta

from pymongo.database import Database

from app.db.models import TransactionType
from app.db.session import day, find_txns, get_business

PERIOD_DAYS = {"today": 1, "7d": 7, "30d": 30, "month": 30}


def _sum_amounts(txns: list, txn_type: TransactionType) -> float:
    return sum(float(t.amount) for t in txns if t.type == txn_type)


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return ((current - previous) / previous) * 100


def get_overview(db: Database, business_id: int, period: str = "30d") -> dict:
    days = PERIOD_DAYS.get(period, 30)
    today = date.today()
    current_start = today - timedelta(days=days)
    previous_start = today - timedelta(days=days * 2)

    current_txns = find_txns(db, {"business_id": business_id, "txn_date": {"$gt": day(current_start), "$lte": day(today)}})
    previous_txns = find_txns(db, {"business_id": business_id, "txn_date": {"$gt": day(previous_start), "$lte": day(current_start)}})

    current_income = _sum_amounts(current_txns, TransactionType.income)
    current_expenses = _sum_amounts(current_txns, TransactionType.expense)
    previous_income = _sum_amounts(previous_txns, TransactionType.income)
    previous_expenses = _sum_amounts(previous_txns, TransactionType.expense)

    current_net = current_income - current_expenses
    previous_net = previous_income - previous_expenses

    all_txns = find_txns(db, {"business_id": business_id, "txn_date": {"$lte": day(today)}})
    business = get_business(db, business_id)
    opening = float(business.opening_balance) if business else 0.0
    all_income = _sum_amounts(all_txns, TransactionType.income)
    all_expenses = _sum_amounts(all_txns, TransactionType.expense)
    cash_balance = opening + all_income - all_expenses

    balance_before_period = cash_balance - current_net

    def sparkline_for(txn_type: TransactionType | None) -> list[float]:
        buckets = [0.0] * days
        for t in current_txns:
            offset = (today - t.txn_date).days
            idx = days - 1 - offset
            if 0 <= idx < days:
                if txn_type is None:
                    buckets[idx] += float(t.amount) if t.type == TransactionType.income else -float(t.amount)
                elif t.type == txn_type:
                    buckets[idx] += float(t.amount)
        return buckets

    cash_spark = []
    running = balance_before_period
    net_daily = sparkline_for(None)
    for v in net_daily:
        running += v
        cash_spark.append(round(running, 2))

    return {
        "period": period,
        "income": {
            "amount": round(current_income, 2),
            "pct_change": _pct_change(current_income, previous_income),
            "sparkline": sparkline_for(TransactionType.income),
        },
        "expenses": {
            "amount": round(current_expenses, 2),
            "pct_change": _pct_change(current_expenses, previous_expenses),
            "sparkline": sparkline_for(TransactionType.expense),
        },
        "net": {
            "amount": round(current_net, 2),
            "pct_change": _pct_change(current_net, previous_net),
            "sparkline": net_daily,
        },
        "cash_balance": {
            "amount": round(cash_balance, 2),
            "pct_change": _pct_change(cash_balance, balance_before_period),
            "sparkline": cash_spark,
        },
    }


def get_cashflow_series(db: Database, business_id: int, period: str = "30d") -> list[dict]:
    days = PERIOD_DAYS.get(period, 30)
    today = date.today()
    start = today - timedelta(days=days)

    txns = find_txns(db, {"business_id": business_id, "txn_date": {"$gt": day(start), "$lte": day(today)}})

    by_day: dict[date, dict[str, float]] = {}
    for i in range(days):
        d = start + timedelta(days=i + 1)
        by_day[d] = {"income": 0.0, "expenses": 0.0}

    for t in txns:
        bucket = by_day.setdefault(t.txn_date, {"income": 0.0, "expenses": 0.0})
        if t.type == TransactionType.income:
            bucket["income"] += float(t.amount)
        else:
            bucket["expenses"] += float(t.amount)

    series = []
    for d in sorted(by_day.keys()):
        income = round(by_day[d]["income"], 2)
        expenses = round(by_day[d]["expenses"], 2)
        series.append({
            "date": d.isoformat(),
            "income": income,
            "expenses": expenses,
            "net": round(income - expenses, 2),
        })
    return series


def get_spending_mix(db: Database, business_id: int, period: str = "30d") -> list[dict]:
    days = PERIOD_DAYS.get(period, 30)
    today = date.today()
    start = today - timedelta(days=days)

    txns = find_txns(
        db,
        {
            "business_id": business_id,
            "type": TransactionType.expense.value,
            "txn_date": {"$gt": day(start), "$lte": day(today)},
        },
    )

    totals: dict[str, float] = {}
    for t in txns:
        totals[t.category] = totals.get(t.category, 0) + float(t.amount)

    grand_total = sum(totals.values()) or 1.0
    result = [
        {
            "category": category,
            "amount": round(amount, 2),
            "pct": round((amount / grand_total) * 100, 1),
        }
        for category, amount in totals.items()
    ]
    result.sort(key=lambda r: r["amount"], reverse=True)
    return result


def get_top_vendors(db: Database, business_id: int, period: str = "30d", limit: int = 10) -> list[dict]:
    days = PERIOD_DAYS.get(period, 30)
    today = date.today()
    start = today - timedelta(days=days)

    txns = find_txns(
        db,
        {
            "business_id": business_id,
            "type": TransactionType.expense.value,
            "txn_date": {"$gt": day(start), "$lte": day(today)},
        },
    )

    totals: dict[str, dict] = {}
    for t in txns:
        entry = totals.setdefault(t.vendor, {"amount": 0.0, "count": 0})
        entry["amount"] += float(t.amount)
        entry["count"] += 1

    grand_total = sum(v["amount"] for v in totals.values()) or 1.0
    result = [
        {
            "vendor": vendor,
            "amount": round(v["amount"], 2),
            "count": v["count"],
            "pct": round((v["amount"] / grand_total) * 100, 1),
        }
        for vendor, v in totals.items()
    ]
    result.sort(key=lambda r: r["amount"], reverse=True)
    return result[:limit]
