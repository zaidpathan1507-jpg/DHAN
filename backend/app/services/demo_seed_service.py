"""Seeds realistic demo transaction history so forecast/insights/credit have
enough data to produce real (non-empty-state) results on first login.

Deterministic (fixed seed) so demo runs are reproducible. All rows are
tagged source=DEMO and must always be visually distinguishable from LIVE
transactions created by the user.
"""

import random
import statistics
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import Transaction, TransactionSource, TransactionType

DEMO_DAYS = 180

VENDORS = {
    "Raw Material & Stock": ["Laxmi Fabrics", "Shree Textiles", "Ganesh Wholesale"],
    "Salaries & Wages": ["Staff Payroll"],
    "Rent": ["Property Owner - Shop 14"],
    "Utilities": ["MSEB Electricity", "Municipal Water Board"],
    "Transport & Fuel": ["Sharma Transport", "HP Petrol Pump"],
    "Food & Refreshments": ["Annapurna Caterers", "Local Tea Stall"],
    "Marketing": ["Digital Ads Co.", "Local Print Media"],
    "Repairs & Maintenance": ["Quick Fix Services", "ABC Electricals"],
    "Taxes & Fees": ["GST Payment", "Trade License Fee"],
}

INCOME_VENDORS = ["Retail Sales", "Wholesale Order", "Online Orders"]


def _add(db: Session, business_id: int, txn_type, amount, vendor, category, txn_date, payment_mode, gstin=None, description=None):
    db.add(Transaction(
        business_id=business_id,
        type=txn_type,
        amount=round(amount, 2),
        vendor=vendor,
        category=category,
        txn_date=txn_date,
        payment_mode=payment_mode,
        description=description,
        gstin=gstin,
        source=TransactionSource.DEMO,
    ))


def reset_demo_data(db: Session, business_id: int) -> None:
    db.query(Transaction).filter(
        Transaction.business_id == business_id,
        Transaction.source == TransactionSource.DEMO,
    ).delete()
    db.commit()


def seed_demo_data(db: Session, business_id: int) -> int:
    reset_demo_data(db, business_id)
    rng = random.Random(42)
    today = date.today()
    start = today - timedelta(days=DEMO_DAYS)

    count = 0
    d = start
    while d <= today:
        if d.weekday() != 6:
            daily_sales = rng.uniform(4800, 9200) * (1 + (today - d).days * -0.0008)
            _add(db, business_id, TransactionType.income, max(daily_sales, 800),
                 rng.choice(INCOME_VENDORS), "Sales Revenue", d, rng.choice(["Cash", "UPI", "Bank Transfer"]))
            count += 1

        if d.weekday() in (1, 4):
            _add(db, business_id, TransactionType.expense, rng.uniform(3500, 9500),
                 rng.choice(VENDORS["Raw Material & Stock"]), "Raw Material & Stock", d, "Bank Transfer",
                 gstin="27AAAPL1234C1Z5")
            count += 1

        if d.weekday() in (0, 2, 3, 5):
            _add(db, business_id, TransactionType.expense, rng.uniform(150, 650),
                 rng.choice(VENDORS["Transport & Fuel"]), "Transport & Fuel", d, "Cash")
            count += 1

        if d.weekday() in (0, 3):
            _add(db, business_id, TransactionType.expense, rng.uniform(80, 320),
                 rng.choice(VENDORS["Food & Refreshments"]), "Food & Refreshments", d, "Cash")
            count += 1

        if d.day == 1:
            _add(db, business_id, TransactionType.expense, rng.uniform(18000, 24000),
                 VENDORS["Salaries & Wages"][0], "Salaries & Wages", d, "Bank Transfer")
            _add(db, business_id, TransactionType.expense, 8000,
                 VENDORS["Rent"][0], "Rent", d, "Bank Transfer")
            count += 2

        if d.day == 5:
            days_ago = (today - d).days
            utility_base = rng.uniform(1800, 2600)
            if days_ago < 30:
                utility_base += 2360
            _add(db, business_id, TransactionType.expense, utility_base,
                 rng.choice(VENDORS["Utilities"]), "Utilities", d, "UPI")
            count += 1

        if d.day == 15 and rng.random() < 0.6:
            _add(db, business_id, TransactionType.expense, rng.uniform(1200, 3500),
                 rng.choice(VENDORS["Marketing"]), "Marketing", d, "UPI")
            count += 1

        if d.day == 20 and rng.random() < 0.4:
            _add(db, business_id, TransactionType.expense, rng.uniform(900, 4200),
                 rng.choice(VENDORS["Repairs & Maintenance"]), "Repairs & Maintenance", d, "Cash")
            count += 1

        if d.day == 10 and d.month % 3 == 0:
            _add(db, business_id, TransactionType.expense, rng.uniform(3000, 7000),
                 "GST Payment", "Taxes & Fees", d, "Bank Transfer")
            count += 1

        d += timedelta(days=1)

    one_off_date = today - timedelta(days=3)
    _add(db, business_id, TransactionType.expense, 42300,
         "MSEB Electricity", "Utilities", one_off_date, "Bank Transfer",
         description="One-time equipment repair surcharge")
    count += 1

    db.commit()
    _apply_anomaly_flags(db, business_id)
    return count


def _apply_anomaly_flags(db: Session, business_id: int) -> None:
    expenses = (
        db.query(Transaction)
        .filter(Transaction.business_id == business_id, Transaction.type == TransactionType.expense)
        .all()
    )
    by_category: dict[str, list[Transaction]] = {}
    for t in expenses:
        by_category.setdefault(t.category, []).append(t)

    for category, txns in by_category.items():
        if len(txns) < 5:
            continue
        amounts = [float(t.amount) for t in txns]
        median = statistics.median(amounts)
        mad = statistics.median([abs(a - median) for a in amounts]) or 1e-9
        for t in txns:
            z = 0.6745 * (float(t.amount) - median) / mad
            t.is_anomaly = z > 3.5
    db.commit()
