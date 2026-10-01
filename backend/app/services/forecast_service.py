"""30-day cash forecast via weighted moving average + trend.

Method is intentionally simple and fully disclosed to the UI: the last 3
rolling 30-day periods are weighted 20/30/50 (oldest -> newest), plus a
linear trend term. Backtest MAPE is computed by replaying the same method
against held-out historical periods so the UI can show real accuracy, not a
made-up number.
"""

import statistics
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import Business, Transaction, TransactionType

PERIOD_LENGTH_DAYS = 30
ROLLING_PERIODS = 6
WEIGHTS = [0.2, 0.3, 0.5]
MIN_PERIODS_FOR_FORECAST = 3
MIN_PERIODS_FOR_BACKTEST = 4


def _period_bounds(today: date, periods_back: int) -> list[tuple[date, date]]:
    bounds = []
    for i in range(periods_back, 0, -1):
        end = today - timedelta(days=(i - 1) * PERIOD_LENGTH_DAYS)
        start = end - timedelta(days=PERIOD_LENGTH_DAYS)
        bounds.append((start, end))
    return bounds


def _period_net(txns: list[Transaction], start: date, end: date) -> float:
    income = sum(float(t.amount) for t in txns if t.type == TransactionType.income and start < t.txn_date <= end)
    expense = sum(float(t.amount) for t in txns if t.type == TransactionType.expense and start < t.txn_date <= end)
    return income - expense


def _weighted_forecast(period_nets: list[float]) -> float:
    last_three = period_nets[-3:]
    weights = WEIGHTS[-len(last_three):]
    weight_sum = sum(weights)
    weighted = sum(v * w for v, w in zip(last_three, weights)) / weight_sum

    if len(period_nets) >= 2:
        trend = (period_nets[-1] - period_nets[-2]) / 2
    else:
        trend = 0
    return weighted + trend


def get_forecast(db: Session, business_id: int) -> dict:
    today = date.today()
    business = db.get(Business, business_id)
    opening = float(business.opening_balance) if business else 0.0

    earliest_bound = today - timedelta(days=ROLLING_PERIODS * PERIOD_LENGTH_DAYS)
    all_txns = (
        db.query(Transaction)
        .filter(Transaction.business_id == business_id, Transaction.txn_date <= today)
        .all()
    )
    pre_window_txns = [t for t in all_txns if t.txn_date <= earliest_bound]
    pre_window_net = sum(
        float(t.amount) if t.type == TransactionType.income else -float(t.amount) for t in pre_window_txns
    )
    current_cash_balance = opening + pre_window_net

    bounds = _period_bounds(today, ROLLING_PERIODS)
    period_nets = []
    for start, end in bounds:
        net = _period_net(all_txns, start, end)
        period_nets.append(net)
        current_cash_balance += net

    non_empty_periods = sum(1 for n in period_nets if n != 0)
    if non_empty_periods < MIN_PERIODS_FOR_FORECAST:
        return {
            "insufficient_history": True,
            "message": "Not enough history yet. Add transactions for a more reliable forecast.",
            "periods_available": non_empty_periods,
            "periods_required": MIN_PERIODS_FOR_FORECAST,
        }

    expected_next_net = _weighted_forecast(period_nets)
    spread = statistics.pstdev(period_nets[-3:]) if len(period_nets) >= 3 else abs(expected_next_net) * 0.1

    expected_closing = current_cash_balance + expected_next_net
    best_case = current_cash_balance + expected_next_net + spread
    worst_case = current_cash_balance + expected_next_net - spread

    backtest_errors = []
    if len(period_nets) >= MIN_PERIODS_FOR_BACKTEST:
        for i in range(3, len(period_nets)):
            predicted = _weighted_forecast(period_nets[:i])
            actual = period_nets[i]
            if actual != 0:
                backtest_errors.append(abs((actual - predicted) / actual))
    backtest_mape = round(statistics.mean(backtest_errors) * 100, 1) if backtest_errors else None

    if expected_closing < 0:
        status_label = "AT RISK"
    elif worst_case < 0:
        status_label = "WATCH"
    else:
        status_label = "HEALTHY"

    category_forecast = _forecast_by_category(db, business_id, today)

    return {
        "insufficient_history": False,
        "current_cash_balance": round(current_cash_balance, 2),
        "expected_closing_balance": round(expected_closing, 2),
        "best_case": round(best_case, 2),
        "worst_case": round(worst_case, 2),
        "status": status_label,
        "history": [
            {"period_end": bounds[i][1].isoformat(), "net": round(period_nets[i], 2)}
            for i in range(len(bounds))
        ],
        "assumptions": {
            "method": "Weighted moving average + trend",
            "weights": WEIGHTS,
            "periods_used": min(3, len(period_nets)),
            "data_used": f"{len(bounds)} rolling 30-day periods",
            "backtest_mape_pct": backtest_mape,
        },
        "category_forecast": category_forecast,
    }


def _forecast_by_category(db: Session, business_id: int, today: date) -> list[dict]:
    bounds = _period_bounds(today, 3)
    start = bounds[0][0]

    txns = (
        db.query(Transaction)
        .filter(
            Transaction.business_id == business_id,
            Transaction.type == TransactionType.expense,
            Transaction.txn_date > start,
            Transaction.txn_date <= today,
            Transaction.is_anomaly.is_(False),
        )
        .all()
    )

    by_category_period: dict[str, list[float]] = {}
    for p_start, p_end in bounds:
        period_totals: dict[str, float] = {}
        for t in txns:
            if p_start < t.txn_date <= p_end:
                period_totals[t.category] = period_totals.get(t.category, 0) + float(t.amount)
        for category, total in period_totals.items():
            by_category_period.setdefault(category, []).append(total)

    results = []
    for category, values in by_category_period.items():
        padded = ([0.0] * (3 - len(values))) + values
        forecast_amt = _weighted_forecast(padded)
        results.append({"category": category, "expected_amount": round(max(forecast_amt, 0), 2)})
    results.sort(key=lambda r: r["expected_amount"], reverse=True)
    return results
