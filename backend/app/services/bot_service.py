"""DHAN's chat bot: log entries from a sentence, a voice note or a bill photo, and answer questions about the books.

Channel-agnostic: `handle()` takes text / audio / image and returns the messages to show. The simulated WhatsApp
screen calls it today; a real WhatsApp webhook would call the same function. Entries from text and voice are saved
straight away with an UNDO (they are short and unambiguous); bill photos are only drafted and need a tap to save,
because a misread total is costlier than one extra tap.
"""

import re
from datetime import date, datetime, timezone
from types import SimpleNamespace

from pymongo.database import Database

from app.core.config import get_settings
from app.db.session import day, oid
from app.services import audit, dhan_ai, groq_service, nl_parser, ocr_service
from app.services.insights_service import flag_anomaly_for_new_transaction

T = {
    "en": {
        "help": "I can log entries and answer questions.\n• Say or type: “paid 500 to Sharma Transport for petrol”\n• Send a photo of a bill\n• Ask: “who owes me money?”, “today's hisaab”\n• Say UNDO to remove the last entry.",
        "greeting": "Namaste! Tell me an expense or income, send a bill photo, or ask about your business. Type HELP to see what I can do.",
        "logged": "Logged ₹{amount} {kind} · {vendor} · {category} · {mode}. Say UNDO to remove it.",
        "need_amount": "I couldn't find an amount. Try: “paid 500 to Sharma Transport for petrol”.",
        "need_vendor": "Who was it with? Try: “paid {amount} to <name>”.",
        "undone": "Removed: ₹{amount} · {vendor}.",
        "nothing_to_undo": "There's nothing to undo.",
        "bill_read": "I read this bill. Save it?",
        "bill_unreadable": "I couldn't read that bill. Type it instead, like “paid 850 to Laxmi Fabrics”.",
        "bill_no_ai": "Reading bill photos needs a Groq key (or Google Vision). Type it instead, like “paid 850 to Laxmi Fabrics”.",
        "voice_fail": "I couldn't hear that clearly. Please try again, or type it.",
        "voice_no_ai": "Voice notes need a Groq key. You can still type or use the microphone in the app.",
        "saved": "Saved ₹{amount} · {vendor}.",
        "discarded": "Okay, I've discarded that bill.",
        "kind_expense": "expense", "kind_income": "income",
    },
    "hi": {
        "help": "मैं एंट्री दर्ज कर सकता हूं और सवालों के जवाब दे सकता हूं।\n• बोलें या लिखें: “शर्मा ट्रांसपोर्ट को 500 रुपये दिए”\n• बिल की फ़ोटो भेजें\n• पूछें: “मुझसे किसको कितना लेना है?”, “आज का हिसाब”\n• आखिरी एंट्री हटाने के लिए UNDO लिखें।",
        "greeting": "नमस्ते! कोई खर्च या आमदनी बताइए, बिल की फ़ोटो भेजिए, या अपने व्यापार के बारे में पूछिए। मैं क्या कर सकता हूं, देखने के लिए HELP लिखें।",
        "logged": "₹{amount} {kind} दर्ज · {vendor} · {category} · {mode}। हटाने के लिए UNDO लिखें।",
        "need_amount": "राशि नहीं मिली। ऐसे बताएं: “शर्मा ट्रांसपोर्ट को 500 रुपये दिए”।",
        "need_vendor": "किसके साथ था? ऐसे बताएं: “<नाम> को {amount} रुपये दिए”।",
        "undone": "हटाया: ₹{amount} · {vendor}।",
        "nothing_to_undo": "हटाने के लिए कुछ नहीं है।",
        "bill_read": "मैंने यह बिल पढ़ा। सहेजें?",
        "bill_unreadable": "यह बिल पढ़ नहीं सका। इसे लिखकर बताएं, जैसे “लक्ष्मी फ़ैब्रिक्स को 850 रुपये दिए”।",
        "bill_no_ai": "बिल की फ़ोटो पढ़ने के लिए Groq की कुंजी (या Google Vision) चाहिए। इसे लिखकर बताएं।",
        "voice_fail": "ठीक से सुनाई नहीं दिया। फिर कोशिश करें, या लिख दें।",
        "voice_no_ai": "वॉइस नोट के लिए Groq की कुंजी चाहिए। आप ऐप में माइक्रोफ़ोन या टाइपिंग इस्तेमाल कर सकते हैं।",
        "saved": "₹{amount} · {vendor} सहेजा गया।",
        "discarded": "ठीक है, वह बिल हटा दिया।",
        "kind_expense": "खर्च", "kind_income": "आमदनी",
    },
    "mr": {
        "help": "मी नोंदी करू शकतो आणि प्रश्नांची उत्तरे देऊ शकतो.\n• बोला किंवा लिहा: “शर्मा ट्रान्सपोर्टला 500 रुपये दिले”\n• बिलाचा फोटो पाठवा\n• विचारा: “माझ्याकडे कोणाचे किती येणे आहे?”, “आजचा हिशोब”\n• शेवटची नोंद काढायला UNDO लिहा.",
        "greeting": "नमस्कार! खर्च किंवा उत्पन्न सांगा, बिलाचा फोटो पाठवा किंवा तुमच्या व्यवसायाबद्दल विचारा. मी काय करू शकतो ते पाहण्यासाठी HELP लिहा.",
        "logged": "₹{amount} {kind} नोंदवले · {vendor} · {category} · {mode}. काढायला UNDO लिहा.",
        "need_amount": "रक्कम सापडली नाही. असे सांगा: “शर्मा ट्रान्सपोर्टला 500 रुपये दिले”.",
        "need_vendor": "कोणाशी व्यवहार होता? असे सांगा: “<नाव>ला {amount} रुपये दिले”.",
        "undone": "काढले: ₹{amount} · {vendor}.",
        "nothing_to_undo": "काढण्यासारखे काही नाही.",
        "bill_read": "मी हे बिल वाचले. जतन करू?",
        "bill_unreadable": "ते बिल वाचता आले नाही. लिहून सांगा, जसे “लक्ष्मी फॅब्रिक्सला 850 रुपये दिले”.",
        "bill_no_ai": "बिलाचा फोटो वाचण्यासाठी Groq की (किंवा Google Vision) लागेल. लिहून सांगा.",
        "voice_fail": "नीट ऐकू आले नाही. पुन्हा प्रयत्न करा किंवा लिहा.",
        "voice_no_ai": "व्हॉइस नोटसाठी Groq की लागेल. तुम्ही अॅपमधील माइक किंवा टायपिंग वापरू शकता.",
        "saved": "₹{amount} · {vendor} जतन केले.",
        "discarded": "ठीक आहे, ते बिल रद्द केले.",
        "kind_expense": "खर्च", "kind_income": "उत्पन्न",
    },
}
QUESTION_START = re.compile(r"^(who|what|how|when|why|which|will|can|is|are|do|did|show|tell|kitna|kitne|kya|kaun|kab|kyon|कितना|कितने|क्या|कौन|कब|क्यों|किसको|कसा|काय|कोण|किती)\b", re.I)


def tr(lang: str, key: str, **v) -> str:
    return T.get(lang, T["en"])[key].format(**v) if v else T.get(lang, T["en"])[key]


def _msg(db: Database, bid: str, role: str, kind: str, text: str = "", **extra) -> dict:
    doc = {"business_id": bid, "role": role, "kind": kind, "text": text, "at": datetime.now(timezone.utc), **extra}
    doc["_id"] = db.bot_messages.insert_one(doc).inserted_id
    return doc


def serialize(m: dict) -> dict:
    return {"id": str(m["_id"]), "role": m["role"], "kind": m["kind"], "text": m.get("text", ""), "card": m.get("card"), "blocks": m.get("blocks"), "at": m["at"]}


def _save_txn(db: Database, user, fields: dict, source_note: str) -> dict:
    d = date.fromisoformat(fields["txn_date"]) if fields.get("txn_date") else date.today()
    doc = {
        "business_id": user.business_id, "type": fields["type"], "amount": float(fields["amount"]), "vendor": fields["vendor"] or "Unnamed", "category": fields["category"],
        "txn_date": day(d), "payment_mode": fields.get("payment_mode") or "Cash", "description": source_note, "gstin": fields.get("gstin"),
        "source": "LIVE", "category_method": "BOT", "category_confidence": None, "created_at": datetime.now(timezone.utc),
    }
    doc["is_anomaly"] = flag_anomaly_for_new_transaction(db, user.business_id, SimpleNamespace(**doc))
    doc["_id"] = db.transactions.insert_one(doc).inserted_id
    audit.log(db, user, "bot.transaction", vendor=doc["vendor"], amount=doc["amount"], type=doc["type"])
    return doc


def _card(doc: dict) -> dict:
    return {"kind": "txn", "txn_id": str(doc["_id"]), "type": doc["type"], "amount": doc["amount"], "vendor": doc["vendor"], "category": doc["category"], "payment_mode": doc["payment_mode"], "date": doc["txn_date"].date().isoformat(), "undone": False}


def _undo(db: Database, user, lang: str) -> tuple[str, dict | None]:
    last = db.bot_messages.find_one({"business_id": user.business_id, "card.kind": "txn", "card.undone": False}, sort=[("at", -1)])
    if not last:
        return tr(lang, "nothing_to_undo"), None
    c = last["card"]
    db.transactions.delete_one({"_id": oid(c["txn_id"]), "business_id": user.business_id})
    db.bot_messages.update_one({"_id": last["_id"]}, {"$set": {"card.undone": True}})
    audit.log(db, user, "bot.undo", vendor=c["vendor"], amount=c["amount"])
    return tr(lang, "undone", amount=f"{c['amount']:,.0f}", vendor=c["vendor"]), None


def _read_bill(image: bytes, mime: str) -> dict | None:
    if groq_service.configured():
        try:
            return groq_service.read_bill(image, mime)
        except groq_service.Unavailable:
            pass
    if get_settings().google_vision_api_key:
        try:
            f = ocr_service.extract_bill_fields(image)["fields"]
            amount = (f.get("amount") or {}).get("value")
            if amount:
                return {"vendor": (f.get("vendor") or {}).get("value") or "", "amount": float(amount), "date": (f.get("date") or {}).get("value"),
                        "gstin": (f.get("gstin") or {}).get("value"), "category": (f.get("category") or {}).get("value") or "Others", "payment_mode": None}
        except Exception:
            pass
    return None


def _answer_question(db: Database, user, text: str, lang: str) -> dict:
    out = dhan_ai.ask(db, user.business_id, text, [], lang if lang in ("en", "hi") else "en")
    return {"text": out["answer"], "blocks": out["blocks"]}


def handle(db: Database, user, *, text: str | None = None, image: tuple[bytes, str] | None = None, audio: tuple[bytes, str, str] | None = None, lang: str = "en", via: str = "text") -> list[dict]:
    bid, new = user.business_id, []
    kind = "voice" if via == "voice" else "text"  # voice = spoken in the app and transcribed before it reached us

    if audio:
        kind = "voice"
        if not groq_service.configured():
            new.append(_msg(db, bid, "user", "voice", "🎤"))
            new.append(_msg(db, bid, "bot", "text", tr(lang, "voice_no_ai")))
            return [serialize(m) for m in new]
        try:
            text = groq_service.transcribe(audio[0], audio[1], audio[2], lang)
        except groq_service.Unavailable:
            text = ""
        if not text:
            new.append(_msg(db, bid, "user", "voice", "🎤"))
            new.append(_msg(db, bid, "bot", "text", tr(lang, "voice_fail")))
            return [serialize(m) for m in new]

    if image:
        new.append(_msg(db, bid, "user", "image", "", image_note="photo"))
        fields = _read_bill(image[0], image[1])
        if not fields:
            new.append(_msg(db, bid, "bot", "text", tr(lang, "bill_unreadable" if groq_service.configured() or get_settings().google_vision_api_key else "bill_no_ai")))
        else:
            fields = {**fields, "type": "expense", "txn_date": fields.get("date")}
            pending_id = str(db.bot_pending.insert_one({"business_id": bid, "fields": fields, "created_at": datetime.now(timezone.utc)}).inserted_id)
            new.append(_msg(db, bid, "bot", "card", tr(lang, "bill_read"), card={"kind": "bill", "pending_id": pending_id, "state": "pending", **{k: fields.get(k) for k in ("vendor", "amount", "category", "payment_mode", "gstin")}, "date": fields.get("date")}))
        return [serialize(m) for m in new]

    text = (text or "").strip()
    if not text:
        return []
    new.append(_msg(db, bid, "user", kind, text))
    low = text.lower()

    if re.fullmatch(r"\W*(undo|वापस|रद्द|हटाओ|काढा|रद्द करा)\W*", low):
        reply, _ = _undo(db, user, lang)
        new.append(_msg(db, bid, "bot", "text", reply))
    elif re.fullmatch(r"\W*(help|menu|मदद|मेनू|मदत)\W*", low):
        new.append(_msg(db, bid, "bot", "text", tr(lang, "help")))
    elif re.fullmatch(r"\W*(hi|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|हेलो)\W*", low):
        new.append(_msg(db, bid, "bot", "text", tr(lang, "greeting")))
    else:
        parsed = nl_parser.parse_spoken_transaction(text)
        tokens = low.replace(",", " ").split()
        entryish = parsed["amount"] and not QUESTION_START.match(low) and "?" not in low and (
            any(nl_parser.is_type_word(t) for t in tokens) or any(t in nl_parser.VENDOR_MARKERS for t in tokens) or any(nl_parser.CURRENCY.match(t) for t in tokens))
        if entryish:
            if not parsed["vendor"]:
                new.append(_msg(db, bid, "bot", "text", tr(lang, "need_vendor", amount=f"{parsed['amount']:,.0f}")))
            else:
                doc = _save_txn(db, user, parsed, f"Logged via DHAN bot: {text[:140]}")
                new.append(_msg(db, bid, "bot", "card", tr(lang, "logged", amount=f"{doc['amount']:,.0f}", kind=tr(lang, f"kind_{doc['type']}"), vendor=doc["vendor"], category=doc["category"], mode=doc["payment_mode"]), card=_card(doc)))
        else:
            ans = _answer_question(db, user, text, lang)
            new.append(_msg(db, bid, "bot", "text", ans["text"], blocks=ans["blocks"]))
    return [serialize(m) for m in new]


def confirm_bill(db: Database, user, pending_id: str, accept: bool, lang: str) -> dict:
    pend = db.bot_pending.find_one({"_id": oid(pending_id), "business_id": user.business_id}) if oid(pending_id) else None
    if not pend:
        return {"error": "not-found"}
    db.bot_pending.delete_one({"_id": pend["_id"]})
    card_q = {"business_id": user.business_id, "card.pending_id": pending_id}
    if not accept:
        db.bot_messages.update_one(card_q, {"$set": {"card.state": "discarded"}})
        return {"messages": [serialize(_msg(db, user.business_id, "bot", "text", tr(lang, "discarded")))]}
    doc = _save_txn(db, user, pend["fields"], "Logged via DHAN bot from a bill photo")
    db.bot_messages.update_one(card_q, {"$set": {"card.state": "saved"}})
    msg = _msg(db, user.business_id, "bot", "card", tr(lang, "saved", amount=f"{doc['amount']:,.0f}", vendor=doc["vendor"]), card=_card(doc))
    return {"messages": [serialize(msg)]}
