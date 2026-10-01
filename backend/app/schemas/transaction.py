from datetime import date, datetime

from pydantic import BaseModel, Field

from app.db.models import TransactionSource, TransactionType


class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0)
    vendor: str
    category: str
    txn_date: date
    payment_mode: str = "Cash"
    description: str | None = None
    gstin: str | None = None


class TransactionUpdate(BaseModel):
    type: TransactionType | None = None
    amount: float | None = None
    vendor: str | None = None
    category: str | None = None
    txn_date: date | None = None
    payment_mode: str | None = None
    description: str | None = None
    gstin: str | None = None


class TransactionOut(BaseModel):
    id: int
    type: TransactionType
    amount: float
    vendor: str
    category: str
    txn_date: date
    payment_mode: str
    description: str | None
    gstin: str | None
    source: TransactionSource
    is_anomaly: bool
    category_method: str | None
    category_confidence: float | None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListOut(BaseModel):
    total: int
    items: list[TransactionOut]
