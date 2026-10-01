import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


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


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    business_type: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100))
    opening_balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="business")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="business")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    business: Mapped["Business"] = relationship(back_populates="users")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    vendor: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    txn_date: Mapped[date] = mapped_column(Date, index=True)
    payment_mode: Mapped[str] = mapped_column(String(50), default="Cash")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source: Mapped[TransactionSource] = mapped_column(Enum(TransactionSource), default=TransactionSource.LIVE)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=False)
    category_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category_confidence: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    business: Mapped["Business"] = relationship(back_populates="transactions")
