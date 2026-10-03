from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.core.security import decode_access_token
from app.db.session import database, oid, to_obj

bearer_scheme = HTTPBearer()

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# POSTs that only read or compute, so a read-only accountant may still use them.
READ_ONLY_POSTS = {"/api/v1/ai/ask", "/api/v1/voice/transcribe", "/api/v1/notifications/read"}


def get_db() -> Database:
    return database


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Database = Depends(get_db),
):
    user_id = decode_access_token(credentials.credentials)
    _id = oid(user_id) if user_id else None
    if _id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = to_obj(db.users.find_one({"_id": _id}))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    user.role = getattr(user, "role", "owner")
    # Customers have no business: they may only use their own portal and read their profile.
    if user.role == "customer" and not request.url.path.startswith(("/api/v1/customer", "/api/v1/auth/me")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is a customer account.")
    # One chokepoint for the accountant role: read-only everywhere except the whitelisted read-style POSTs.
    if user.role == "accountant" and request.method not in SAFE_METHODS and request.url.path not in READ_ONLY_POSTS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Read-only access: ask the owner to make this change.")
    return user


def require_owner(user=Depends(get_current_user)):
    if user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can do this.")
    return user
