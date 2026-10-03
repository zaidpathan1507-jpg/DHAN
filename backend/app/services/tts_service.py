"""Spoken answers with natural Indian-language voices (Microsoft neural voices through edge-tts, no API key).

Browsers often have no Marathi voice at all and read Devanagari in a Hindi or English accent, so the server makes the
audio. If this service is unreachable the app falls back to the browser's own speech synthesis.
"""

import re

import edge_tts

VOICES = {"en": "en-IN-NeerjaNeural", "hi": "hi-IN-SwaraNeural", "mr": "mr-IN-AarohiNeural"}
RUPEES = {"en": "rupees", "hi": "रुपये", "mr": "रुपये"}
MAX_CHARS = 700


def clean(text: str, lang: str) -> str:
    """Make written text speakable: no markdown, and '₹1,23,456' becomes '123456 rupees' in the right language."""
    text = re.sub(r"[*_`#>]+", "", text)
    text = re.sub(r"₹\s?([\d,]+(?:\.\d+)?)", lambda m: f"{m.group(1).replace(',', '')} {RUPEES[lang]}", text)
    return re.sub(r"\s+", " ", text).strip()[:MAX_CHARS]


async def synthesize(text: str, lang: str) -> bytes:
    lang = lang if lang in VOICES else "en"
    audio = bytearray()
    async for chunk in edge_tts.Communicate(clean(text, lang), VOICES[lang]).stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return bytes(audio)
