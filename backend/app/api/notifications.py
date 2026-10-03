"""Owner notifications: a list for the bell, and a Server-Sent Events stream so new ones arrive live."""

import asyncio
import json

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.core.security import decode_access_token
from app.db.session import database, oid

router = APIRouter(prefix="/notifications", tags=["notifications"])

POLL_SECONDS = 1.5
KEEPALIVE_SECONDS = 15


def _out(n: dict) -> dict:
    return {"id": str(n["_id"]), "type": n["type"], "params": n["params"], "receivable_id": n["receivable_id"], "at": n["at"], "read": n["read"]}


@router.get("")
def list_notifications(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    q = {"business_id": current_user.business_id}
    return {"items": [_out(n) for n in db.notifications.find(q).sort("_id", -1).limit(40)], "unread": db.notifications.count_documents({**q, "read": False})}


@router.post("/read")
def mark_read(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    db.notifications.update_many({"business_id": current_user.business_id, "read": False}, {"$set": {"read": True}})
    return {"status": "ok"}


def _since(business_id: str, last_id: ObjectId) -> list[dict]:
    return list(database.notifications.find({"business_id": business_id, "_id": {"$gt": last_id}}).sort("_id", 1))


@router.get("/stream")
async def stream(request: Request, token: str):
    """EventSource cannot send headers, so the JWT comes as a query parameter.

    Async on purpose: while idle this holds no worker thread (each poll is a short threadpool hop) and it ends as
    soon as the browser disconnects, so open tabs and hot reloads cannot exhaust the server.
    """
    user_id = decode_access_token(token)
    _id = oid(user_id) if user_id else None
    user = await run_in_threadpool(database.users.find_one, {"_id": _id}) if _id else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=403, detail="Owner accounts only")
    latest = await run_in_threadpool(lambda: database.notifications.find_one({"business_id": business_id}, sort=[("_id", -1)]))
    last_id: ObjectId = latest["_id"] if latest else ObjectId("0" * 24)

    async def events():
        nonlocal last_id
        yield "retry: 3000\n\n"
        idle = 0.0
        while not await request.is_disconnected():
            fresh = await run_in_threadpool(_since, business_id, last_id)
            for n in fresh:
                last_id = n["_id"]
                yield f"data: {json.dumps(_out(n), default=lambda o: o.isoformat())}\n\n"
            idle = 0.0 if fresh else idle + POLL_SECONDS
            if idle >= KEEPALIVE_SECONDS:
                yield ": keepalive\n\n"
                idle = 0.0
            await asyncio.sleep(POLL_SECONDS)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
