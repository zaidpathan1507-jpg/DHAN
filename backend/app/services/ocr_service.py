"""Bill OCR via Google Cloud Vision, with transparent, editable field extraction.

Google Vision returns raw text only (no structured fields), so amount /
vendor / date / GSTIN are pulled out with regex heuristics below. Each
extracted field carries a confidence score driven by how strong the pattern
match was -- never a fabricated number. The caller must always let the user
review/edit before saving; this service never creates a transaction itself.
"""

import base64
import re
from datetime import date, datetime

import requests

from app.core.config import get_settings

GSTIN_PATTERN = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z]\d\b")
AMOUNT_PATTERN = re.compile(r"(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)
DATE_PATTERNS = [
    (re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b"), "%d/%m/%Y"),
    (re.compile(r"\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b"), "%d %b %Y"),
]

CATEGORY_KEYWORDS = {
    "Utilities": ["electricity", "mseb", "water board", "power", "gas bill"],
    "Rent": ["rent", "lease"],
    "Transport & Fuel": ["petrol", "diesel", "fuel", "transport", "freight"],
    "Raw Material & Stock": ["fabric", "material", "stock", "supplies", "wholesale"],
    "Food & Refreshments": ["restaurant", "cafe", "food", "refreshment"],
    "Repairs & Maintenance": ["repair", "maintenance", "service charge"],
    "Marketing": ["advertisement", "marketing", "promotion"],
    "Taxes & Fees": ["gst", "tax", "fee", "penalty"],
}


class OCRUnavailable(Exception):
    pass


def _call_google_vision(image_bytes: bytes) -> str:
    settings = get_settings()
    if not settings.google_vision_api_key:
        raise OCRUnavailable("Bill reading unavailable. Enter the transaction manually.")

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    url = f"https://vision.googleapis.com/v1/images:annotate?key={settings.google_vision_api_key}"
    body = {
        "requests": [
            {
                "image": {"content": encoded},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }
    try:
        response = requests.post(url, json=body, timeout=15)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise OCRUnavailable("Bill reading unavailable. Enter the transaction manually.") from exc

    data = response.json()
    try:
        return data["responses"][0]["fullTextAnnotation"]["text"]
    except (KeyError, IndexError):
        return ""


def _extract_amount(text: str) -> tuple[float | None, float]:
    matches = AMOUNT_PATTERN.findall(text)
    if not matches:
        return None, 0.0
    values = [float(m.replace(",", "")) for m in matches]
    return max(values), 90.0 if len(matches) == 1 else 70.0


def _extract_gstin(text: str) -> tuple[str | None, float]:
    match = GSTIN_PATTERN.search(text.upper())
    if match:
        return match.group(0), 95.0
    return None, 0.0


def _extract_date(text: str) -> tuple[date | None, float]:
    for pattern, fmt in DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                if fmt == "%d/%m/%Y":
                    day, month, year = match.groups()
                    year = year if len(year) == 4 else f"20{year}"
                    return date(int(year), int(month), int(day)), 80.0
                parsed = datetime.strptime(match.group(0), fmt)
                return parsed.date(), 85.0
            except ValueError:
                continue
    return None, 0.0


def _extract_vendor(text: str) -> tuple[str | None, float]:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for line in lines[:3]:
        if not AMOUNT_PATTERN.search(line) and len(line) > 2 and not line.isdigit():
            return line[:100], 55.0
    return None, 0.0


def _extract_category(text: str) -> tuple[str | None, float]:
    lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return category, 75.0
    return None, 0.0


def extract_bill_fields(image_bytes: bytes) -> dict:
    text = _call_google_vision(image_bytes)

    amount, amount_conf = _extract_amount(text)
    vendor, vendor_conf = _extract_vendor(text)
    txn_date, date_conf = _extract_date(text)
    gstin, gstin_conf = _extract_gstin(text)
    category, category_conf = _extract_category(text)

    return {
        "raw_text": text,
        "fields": {
            "amount": {"value": amount, "confidence": amount_conf},
            "vendor": {"value": vendor, "confidence": vendor_conf},
            "date": {"value": txn_date.isoformat() if txn_date else None, "confidence": date_conf},
            "gstin": {"value": gstin, "confidence": gstin_conf},
            "category": {"value": category, "confidence": category_conf},
        },
        "method": "google-vision-document-text-detection + regex-heuristics",
    }
