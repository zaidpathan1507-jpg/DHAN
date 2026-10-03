"""DHAN bot endpoints + Whisper transcription. The simulated WhatsApp screen uses these; a real WhatsApp webhook
would call bot_service.handle() the same way."""

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.deps import get_current_user, get_db
from app.services import bot_service, groq_service, tts_service

router = APIRouter(tags=["bot"])
voice_router = APIRouter(prefix="/voice", tags=["voice"])
MAX_UPLOAD = 6 * 1024 * 1024


class Confirm(BaseModel):
    pending_id: str
    accept: bool
    lang: Literal["en", "hi", "mr"] = "en"


async def _read(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="That file is too large (6 MB max).")
    return data


@router.get("/bot/messages")
def messages(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    rows = list(db.bot_messages.find({"business_id": current_user.business_id}).sort("at", -1).limit(60))
    return [bot_service.serialize(m) for m in reversed(rows)]


@router.post("/bot/message")
async def send_message(
    text: str | None = Form(default=None, max_length=600),
    lang: Literal["en", "hi", "mr"] = Form(default="en"),
    via: Literal["text", "voice"] = Form(default="text"),
    file: UploadFile | None = File(default=None),
    db: Database = Depends(get_db),
    current_user=Depends(get_current_user),
):
    kwargs = {"text": text, "lang": lang, "via": via}
    if file:
        data, ctype = await _read(file), (file.content_type or "")
        if ctype.startswith("image/"):
            kwargs["image"] = (data, ctype)
        elif ctype.startswith(("audio/", "video/")):  # browsers label webm voice notes either way
            kwargs["audio"] = (data, file.filename or "voice.webm", ctype)
        else:
            raise HTTPException(status_code=415, detail="Send text, a photo or a voice note.")
    return await run_in_threadpool(lambda: bot_service.handle(db, current_user, **kwargs))


@router.post("/bot/confirm")
async def confirm(payload: Confirm, db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    out = await run_in_threadpool(bot_service.confirm_bill, db, current_user, payload.pending_id, payload.accept, payload.lang)
    if out.get("error"):
        raise HTTPException(status_code=404, detail="That draft has expired.")
    return out["messages"]


@router.delete("/bot/messages", status_code=204)
def clear(db: Database = Depends(get_db), current_user=Depends(get_current_user)):
    db.bot_messages.delete_many({"business_id": current_user.business_id})


@voice_router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), lang: Literal["en", "hi", "mr"] = Form(default="en"), current_user=Depends(get_current_user)):
    if not groq_service.configured():
        raise HTTPException(status_code=503, detail="Voice transcription is not configured.")
    data = await _read(file)
    try:
        text = await run_in_threadpool(groq_service.transcribe, data, file.filename or "voice.webm", file.content_type or "audio/webm", lang)
    except groq_service.Unavailable:
        raise HTTPException(status_code=502, detail="Couldn't transcribe that. Please try again.")
    return {"text": text}


class Speak(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    lang: Literal["en", "hi", "mr"] = "en"


@voice_router.post("/speak")
async def speak(payload: Speak, current_user=Depends(get_current_user)):
    """Text -> natural-sounding mp3 in English, Hindi or Marathi. 503 lets the app fall back to the browser's voice."""
    try:
        audio = await tts_service.synthesize(payload.text, payload.lang)
    except Exception:
        raise HTTPException(status_code=503, detail="Voice is unavailable right now.")
    if not audio:
        raise HTTPException(status_code=503, detail="Voice is unavailable right now.")
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})
