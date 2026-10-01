"""Rule-based insight & anomaly generation.

Every insight exposes its method (e.g. "robust z-score", "period comparison")
so the UI never presents a number without explaining where it came from.
"""

import statistics
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import Transaction, TransactionType

ANOMALY_Z_THRESHOLD = 3.5
MIN_SAMPLES_FOR_ANOMALY = 5


def _robust_z_scores(amounts: list[float]) -> tuple[float, float, list[float]]:
    median = statistics.median(amounts)
    abs_devs = [abs(a - median) for a in amounts]
    mad = statistics.median(abs_devs) or 1e-9
    z_scores = [0.6745 * (a - median) / mad for a in amounts]
    return median, mad, z_scores


def flag_anomaly_for_new_transaction(db: Session, business_id: int, txn: Transaction) -> bool:
    if txn.type != TransactionType.expense:
        return False

    history = (
        db.query(Transaction)
        .filter(
            Transaction.business_id == business_id,
            Transaction.category == txn.category,
            Transaction.type == TransactionType.expense,
            Transaction.id != txn.id,
        )
        .all()
    )
    if len(history) < MIN_SAMPLES_FOR_ANOMALY:
        return False

    amounts = [float(h.amount) for h in history]
    median, mad, _ = _robust_z_scores(amounts)
    z = 0.6745 * (float(txn.amount) - median) / mad
    return z > ANOMALY_Z_THRESHOLD


def generate_insights(db: Session, business_id: int) -> list[dict]:
    today = date.today()
    current_start = today - timedelta(days=30)
    previous_start = today - timedelta(days=60)

    all_expenses = (
        db.query(Transaction)
        .filter(
            Transaction.business_id == business_id,
            Transaction.type == TransactionType.expense,
            Transaction.txn_date >= previous_start,
        )
        .all()
    )

    insights: list[dict] = []

    by_category_current: dict[str, float] = {}
    by_category_previous: dict[str, float] = {}
    for txn in all_expenses:
        amt = float(txn.amount)
        if txn.txn_date >= current_start:
            by_category_current[txn.category] = by_category_current.get(txn.category, 0) + amt
        else:
            by_category_previous[txn.category] = by_category_previous.get(txn.category, 0) + amt

    for category, current_amt in by_category_current.items():
        prev_amt = by_category_previous.get(category, 0)
        if prev_amt <= 0:
            continue
        pct_change = ((current_amt - prev_amt) / prev_amt) * 100
        if pct_change >= 15:
            insights.append({
                "id": f"spend-change-{category}",
                "type": "spending_pattern",
                "severity": "warning" if pct_change < 40 else "high",
                "title": f"{category.upper()} SPENDING",
                "headline": f"+{pct_change:.0f}%",
                "body": (
                    f"Your {category} spending increased from "
                    f"₹{prev_amt:,.0f} → ₹{current_amt:,.0f}."
                ),
                "action": "Review recent bills for unusual charges.",
                "method": "period comparison (last 30d vs previous 30d)",
            })
        elif pct_change <= -15:
            savings = prev_amt - current_amt
            insights.append({
                "id": f"spend-drop-{category}",
                "type": "savings_opportunity",
                "severity": "normal",
                "title": f"{category.upper()} DOWN",
                "headline": f"{pct_change:.0f}%",
                "body": (
                    f"Your {category} spending dropped from "
                    f"₹{prev_amt:,.0f} → ₹{current_amt:,.0f}."
                ),
                "action": f"You saved approximately ₹{savings:,.0f} this period.",
                "method": "period comparison (last 30d vs previous 30d)",
            })

    category_groups: dict[str, list[float]] = {}
    for txn in all_expenses:
        category_groups.setdefault(txn.category, []).append(float(txn.amount))

    recent_anomalies = (
        db.query(Transaction)
        .filter(
            Transaction.business_id == business_id,
            Transaction.type == TransactionType.expense,
            Transaction.is_anomaly.is_(True),
            Transaction.txn_date >= current_start,
        )
        .all()
    )

    for txn in recent_anomalies:
        amounts = category_groups.get(txn.category, [])
        if len(amounts) < MIN_SAMPLES_FOR_ANOMALY:
            continue
        median, mad, _ = _robust_z_scores(amounts)
        z = 0.6745 * (float(txn.amount) - median) / mad
        sorted_amts = sorted(amounts)
        lo = sorted_amts[max(0, int(len(sorted_amts) * 0.25) - 1)]
        hi = sorted_amts[min(len(sorted_amts) - 1, int(len(sorted_amts) * 0.75))]
        insights.append({
            "id": f"anomaly-{txn.id}",
            "type": "needs_attention",
            "severity": "high",
            "title": "UNUSUAL EXPENSE",
            "headline": f"₹{float(txn.amount):,.0f}",
            "category": txn.category,
            "body": f"{z:.1f}× your usual expense. Median: ₹{median:,.0f}. Usual range: ₹{lo:,.0f} – ₹{hi:,.0f}.",
            "action": "Expected / Needs Review",
            "method": f"robust z-score (z={z:.1f})",
            "vendor": txn.vendor,
            "txn_id": txn.id,
        })

    severity_rank = {"high": 0, "warning": 1, "normal": 2}
    insights.sort(key=lambda i: severity_rank.get(i["severity"], 3))
    return insights
