"""Activity log: who did what, when. Written by every important mutation; read on Settings → Activity log."""

from datetime import datetime, timezone

from pymongo.database import Database


def log(db: Database, user, action: str, **detail) -> None:
    db.audit.insert_one({
        "business_id": user.business_id, "user_id": user.id, "user_name": user.name, "role": getattr(user, "role", "owner"),
        "action": action, "detail": {k: v for k, v in detail.items() if v is not None}, "at": datetime.now(timezone.utc),
    })
