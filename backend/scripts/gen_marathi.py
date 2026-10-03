# One-off generator: translates every English UI string (and the udhaar reminder templates) into Marathi with Groq.
# Output is committed, so the app never calls this at runtime. Re-run after adding strings: it only translates what is missing.
#   Run from backend/:  PYTHONIOENCODING=utf-8 python scripts/gen_marathi.py
import json
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, ".")
from app.core.config import get_settings  # noqa: E402

LIB = Path("../frontend/src/lib")
OUT = LIB / "strings.mr.generated.json"
EN_BLOCKS = [("strings.js", "en"), ("strings.wow.js", "enWow"), ("strings.udhaar.js", "enUd"), ("strings.ai.js", "enAi"), ("strings.v3.js", "enV3"), ("strings.v4.js", "enV4")]
PLACEHOLDER = re.compile(r"\{[a-zA-Z_0-9]+\}")
KEEP = "DHAN, DHAN AI, GST, GSTIN, GSTR-1, GSTR-3B, ITC, UPI, NEFT, IMPS, RTGS, WhatsApp, Razorpay, CIBIL, TDS, CSV, PDF, EMI, OTP, QR, Groq, Udyam, SBXN"
SYSTEM = (
    "You translate app UI text from English into natural, everyday Marathi (Devanagari) for small-business owners in Maharashtra. "
    "Rules: keep every {placeholder} exactly as written (same names, same count); keep numbers, ₹ amounts, emoji and punctuation style; "
    f"do not translate these terms or brand names: {KEEP}; use simple spoken Marathi, not Sanskritised or Hindi words (say 'खर्च', 'उत्पन्न', 'शिल्लक', 'येणे', 'देणे'); "
    "keep it as short as the English. You receive a JSON object {key: english}. Reply with ONLY a JSON object with the same keys and Marathi values."
)


def parse_en() -> dict[str, str]:
    out = {}
    for fname, const in EN_BLOCKS:
        s = (LIB / fname).read_text(encoding="utf-8")
        start = s.index(f"export const {const} = {{")
        end = s.index("\nexport const", start + 10) if "\nexport const" in s[start + 10:] else len(s)
        for m in re.finditer(r'^\s*"([^"]+)":\s*("(?:[^"\\]|\\.)*"),?\s*$', s[start:end], re.M):
            out[m.group(1)] = json.loads(m.group(2))
    return out


def hand_written() -> set[str]:
    s = (LIB / "strings.mr.js").read_text(encoding="utf-8")
    return set(re.findall(r'^\s*"([^"]+)":', s, re.M))


def chat(payload: dict) -> dict:
    cfg = get_settings()
    for attempt in range(8):
        r = requests.post(f"{cfg.groq_base_url.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {cfg.groq_api_key}"}, timeout=90,
                          json={"model": cfg.groq_model, "temperature": 0.1, "response_format": {"type": "json_object"},
                                "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]})
        if r.status_code == 429:
            wait = float(r.headers.get("retry-after") or 20)
            print(f"  rate limited, waiting {wait:.0f}s", flush=True)
            time.sleep(wait + 1)
            continue
        r.raise_for_status()
        return json.loads(r.json()["choices"][0]["message"]["content"])
    raise RuntimeError("gave up after repeated rate limits")


def valid(en: str, mr: str) -> bool:
    return isinstance(mr, str) and mr.strip() and sorted(PLACEHOLDER.findall(en)) == sorted(PLACEHOLDER.findall(mr)) and bool(re.search(r"[ऀ-ॿ]", mr) or not re.search(r"[A-Za-z]{4,}", en))


def main():
    en = parse_en()
    done = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    todo = [k for k in en if k not in done and k not in hand_written()]
    print(f"{len(en)} strings, {len(done)} already translated, {len(todo)} to do", flush=True)
    for i in range(0, len(todo), 25):
        batch = {k: en[k] for k in todo[i:i + 25]}
        for attempt in range(3):
            try:
                got = chat(batch)
            except Exception as exc:  # noqa: BLE001
                print("  error:", str(exc)[:100], flush=True)
                time.sleep(5)
                continue
            good = {k: got[k].strip() for k in batch if k in got and valid(batch[k], got[k])}
            done.update(good)
            batch = {k: v for k, v in batch.items() if k not in good}
            if not batch:
                break
        OUT.write_text(json.dumps(done, ensure_ascii=False, indent=0), encoding="utf-8")
        print(f"  {min(i + 25, len(todo))}/{len(todo)}  (skipped so far: {len([k for k in todo[:i + 25] if k not in done])})", flush=True)

    # udhaar reminder templates sent to customers (subject, body) per step
    from app.services.udhaar_service import MESSAGES

    msgs = {}
    mpath = Path("app/services/messages_mr.json")
    if not mpath.exists():
        flat = {f"{step}|{i}": text for step, pair in MESSAGES["en"].items() for i, text in enumerate(pair)}
        got = {}
        for chunk in range(0, len(flat), 10):
            part = dict(list(flat.items())[chunk:chunk + 10])
            res = chat(part)
            got.update({k: v for k, v in res.items() if k in part and valid(part[k], v)})
        for step, pair in MESSAGES["en"].items():
            msgs[step] = [got.get(f"{step}|0", pair[0]), got.get(f"{step}|1", pair[1])]
        mpath.write_text(json.dumps(msgs, ensure_ascii=False, indent=1), encoding="utf-8")
        print("reminder templates written", flush=True)
    print("DONE", len(done), "translated;", len([k for k in en if k not in done and k not in hand_written()]), "left to Hindi fallback", flush=True)


if __name__ == "__main__":
    main()
