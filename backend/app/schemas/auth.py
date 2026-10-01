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
    id: int
    name: str
    business_type: str
    city: str
    opening_balance: float

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    business: BusinessOut

    class Config:
        from_attributes = True
