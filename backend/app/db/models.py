"""Shared enums/constants. MongoDB collections (schemaless):

businesses:   name, business_type, city, opening_balance, created_at
users:        name, phone (unique), password_hash, business_id (str), created_at
transactions: business_id (str), type, amount, vendor, category, txn_date (midnight datetime),
              payment_mode, description, gstin, source, is_anomaly, category_method,
              category_confidence, created_at
"""

import enum


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"


class TransactionSource(str, enum.Enum):
    LIVE = "LIVE"
    DEMO = "DEMO"


CATEGORIES = [
    "Raw Material & Stock",
    "Salaries & Wages",
    "Rent",
    "Utilities",
    "Transport & Fuel",
    "Food & Refreshments",
    "Marketing",
    "Repairs & Maintenance",
    "Taxes & Fees",
    "Others",
]

INCOME_CATEGORIES = ["Sales Revenue", "Services Rendered", "Other Income"]
