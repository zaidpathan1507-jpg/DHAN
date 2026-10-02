"""Groq speech-to-text (Whisper) and bill-photo reading (vision). Both need GROQ_API_KEY; both fail soft.

Whisper makes Hindi/Marathi voice work in every browser (the Web Speech API is Chrome/Edge only). Vision turns a
photographed bill into a draft entry; it never saves anything, the user always confirms.
"""

import base64
import json
import re
from datetime import date

import requests

from app.core.config import get_settings


class Unavailable(Exception):
    """No key configured, or the service failed. Callers fall back to typing."""


def configured() -> bool:
    return bool(get_settings().groq_api_key)


def _headers() -> dict:
    return {"Authorization": f"Bearer {get_settings().groq_api_key}"}


def transcribe(audio: bytes, filename: str, content_type: str, lang: str | None = None) -> str:
    if not configured():
        raise Unavailable("not-configured")
    s = get_settings()
    data = {"model": s.groq_stt_model, "response_format": "json", "temperature": "0"}
    if lang in ("en", "hi", "mr"):
        data["language"] = lang
    try:
        r = requests.post(f"{s.groq_base_url.rstrip('/')}/audio/transcriptions", headers=_headers(), data=data, files={"file": (filename, audio, content_type)}, timeout=60)
        r.raise_for_status()
        return (r.json().get("text") or "").strip()
    except requests.RequestException as exc:
        raise Unavailable(str(exc)[:120]) from exc


READ_PROMPT = (
    "You read photographed Indian shop bills and receipts. Reply with ONLY a JSON object with keys: "
    '"vendor" (shop or business name), "amount" (grand total as a number, rupees), "date" (YYYY-MM-DD or null), '
    '"gstin" (15-character GSTIN or null), "category" (one of: Raw Material & Stock, Salaries & Wages, Rent, Utilities, '
    "Transport & Fuel, Food & Refreshments, Marketing, Repairs & Maintenance, Taxes & Fees, Others), "
    '"payment_mode" (Cash, UPI, Card, Bank Transfer, Cheque or null). Use null for anything you cannot read. Never guess.'
)


def read_bill(image: bytes, mime: str) -> dict:
    """-> draft fields; raises Unavailable if the model is not reachable or the bill could not be read."""
    if not configured():
        raise Unavailable("not-configured")
    s = get_settings()
    body = {
        "model": s.groq_vision_model, "temperature": 0, "max_tokens": 400,
        "messages": [{"role": "user", "content": [{"type": "text", "text": READ_PROMPT}, {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{base64.b64encode(image).decode()}"}}]}],
    }
    try:
        r = requests.post(f"{s.groq_base_url.rstrip('/')}/chat/completions", headers=_headers(), json=body, timeout=60)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        fields = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    except (requests.RequestException, KeyError, AttributeError, ValueError) as exc:
        raise Unavailable(str(exc)[:120]) from exc
    try:
        amount = float(str(fields.get("amount")).replace(",", "")) if fields.get("amount") is not None else None
    except ValueError:
        amount = None
    if not amount or amount <= 0:
        raise Unavailable("unreadable")
    d = fields.get("date")
    try:
        d = date.fromisoformat(d) if d else None
    except ValueError:
        d = None
    return {"vendor": (fields.get("vendor") or "").strip(), "amount": amount, "date": d.isoformat() if d else None, "gstin": fields.get("gstin"),
            "category": fields.get("category") or "Others", "payment_mode": fields.get("payment_mode")}
