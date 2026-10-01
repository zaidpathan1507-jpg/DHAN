"""Indicative, rule-based credit-readiness score.

Explicitly NOT a CIBIL score or a lending decision -- five weighted
components, each a transparent formula over the business's own transaction
history. The frontend must always render the disclaimer alongside the score.
"""

import statistics
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import Business, Transaction, TransactionType

OBSERVATION_DAYS = 90
MIN_TRANSACTIONS = 30
MIN_DAYS_OF_HISTORY = 90

COMPONENT_WEIGHTS = {
    "record_consistency": 0.20,
    "income_stability": 0.20,
    "profitability": 0.25,
    "expense_discipline": 0.20,
    "documentation_quality": 0.15,
}


def _band(score: float) -> str:
    if score >= 85:
        return "EXCELLENT"
    if score >= 70:
        return "GOOD"
    if score >= 50:
        return "FAIR"
    return "NEEDS WORK"


def get_credit_readiness(db: Session, business_id: int) -> dict:
    business = db.get(Business, business_id)
    today = date.today()
    window_start = today - timedelta(days=OBSERVATION_DAYS)

    txns = (
        db.query(Transaction)
        .filter(Transaction.business_id == business_id, Transaction.txn_date > window_start, Transaction.txn_date <= today)
        .all()
    )
    earliest_txn = (
        db.query(Transaction)
        .filter(Transaction.business_id == business_id)
        .order_by(Transaction.txn_date.asc())
        .first()
    )
    days_of_history = (today - earliest_txn.txn_date).days if earliest_txn else 0

    if len(txns) < MIN_TRANSACTIONS or days_of_history < MIN_DAYS_OF_HISTORY:
        return {
            "insufficient_history": True,
            "message": f"{MIN_DAYS_OF_HISTORY} days of data and {MIN_TRANSACTIONS} transactions are required.",
            "transactions_available": len(txns),
            "transactions_required": MIN_TRANSACTIONS,
            "days_available": days_of_history,
            "days_required": MIN_DAYS_OF_HISTORY,
        }

    days_with_activity = len({t.txn_date for t in txns})
    record_consistency = min(100, (days_with_activity / OBSERVATION_DAYS) * 100)

    monthly_income: dict[int, float] = {}
    for t in txns:
        if t.type == TransactionType.income:
            bucket = (today - t.txn_date).days // 30
            monthly_income[bucket] = monthly_income.get(bucket, 0) + float(t.amount)
    income_values = list(monthly_income.values()) or [0]
    if len(income_values) > 1 and statistics.mean(income_values) > 0:
        cv = statistics.pstdev(income_values) / statistics.mean(income_values)
        income_stability = max(0, 100 - cv * 100)
    else:
        income_stability = 50 if income_values[0] > 0 else 0

    total_income = sum(float(t.amount) for t in txns if t.type == TransactionType.income)
    total_expense = sum(float(t.amount) for t in txns if t.type == TransactionType.expense)
    if total_income > 0:
        margin = (total_income - total_expense) / total_income
        profitability = max(0, min(100, (margin + 0.2) / 0.5 * 100))
    else:
        profitability = 0

    expense_txns = [t for t in txns if t.type == TransactionType.expense]
    anomaly_count = sum(1 for t in expense_txns if t.is_anomaly)
    anomaly_rate = (anomaly_count / len(expense_txns)) if expense_txns else 0
    expense_discipline = max(0, 100 - anomaly_rate * 400)

    documented = sum(
        1 for t in txns if t.description and t.payment_mode and (t.gstin or t.type == TransactionType.income)
    )
    documentation_quality = (documented / len(txns)) * 100 if txns else 0

    components = {
        "record_consistency": round(record_consistency, 1),
        "income_stability": round(income_stability, 1),
        "profitability": round(profitability, 1),
        "expense_discipline": round(expense_discipline, 1),
        "documentation_quality": round(documentation_quality, 1),
    }

    overall = sum(components[k] * w for k, w in COMPONENT_WEIGHTS.items())

    labels = {
        "record_consistency": "Record consistency",
        "income_stability": "Income stability",
        "profitability": "Profitability",
        "expense_discipline": "Expense discipline",
        "documentation_quality": "Documentation quality",
    }

    component_list = [
        {
            "key": key,
            "label": labels[key],
            "score": components[key],
            "weight": COMPONENT_WEIGHTS[key],
        }
        for key in COMPONENT_WEIGHTS
    ]
    component_list.sort(key=lambda c: c["score"])
    biggest_opportunity = component_list[0]

    tips = {
        "record_consistency": "Log transactions on more days of the month, even small ones, for a more complete record.",
        "income_stability": "Try to diversify income sources or smooth revenue across the month.",
        "profitability": "Review your largest expense categories for cost-saving opportunities.",
        "expense_discipline": "Investigate and resolve the unusual expenses flagged in Insights.",
        "documentation_quality": "Add descriptions and GSTIN where applicable to your transactions.",
    }

    return {
        "insufficient_history": False,
        "score": round(overall, 1),
        "band": _band(overall),
        "components": component_list,
        "biggest_opportunity": {
            "label": biggest_opportunity["label"],
            "tip": tips[biggest_opportunity["key"]],
        },
        "disclaimer": "This is an indicative credit-readiness indicator, not a CIBIL score or lending decision.",
    }
