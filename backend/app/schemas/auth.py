from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    name: str
    phone: str
    password: str = Field(min_length=6)
    business_name: str
    business_type: str
    city: str
    opening_balance: float = 0


class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BusinessOut(BaseModel):
    id: str
    name: str
    business_type: str
    city: str
    opening_balance: float
    upi_id: str | None = None

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: str
    name: str
    phone: str
    role: str = "owner"
    two_factor: bool = False
    report_email: str | None = None
    weekly_report: bool = False
    business: BusinessOut

    class Config:
        from_attributes = True


class BusinessPaymentUpdate(BaseModel):
    upi_id: str | None = Field(default=None, max_length=80, pattern=r"^[\w.\-]{2,}@[A-Za-z]{2,}$")
