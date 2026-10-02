"""Turn a spoken or typed sentence into a transaction draft ("paid 500 to Sharma Transport for petrol by UPI",
"Laxmi Fabrics ko 5 hazaar diye cash", "आज 12000 रुपये मिले रमेश से"). Port of the frontend voiceParser so the
WhatsApp bot and the web app behave identically. Rule-based and offline: no model needed."""

import re
from datetime import date, timedelta

EXPENSE_RULES = [
    ("Transport & Fuel", ["petrol", "diesel", "fuel", "cng", "uber", "ola ", "rapido", "cab", "toll", "transport", "tempo", "पेट्रोल", "डीजल", "भाड़ा", "भाडे", "ट्रांसपोर्ट"]),
    ("Rent", ["rent", "kiraya", "kiraaya", "bhade", "किराया", "भाडे", "भाड्याने"]),
    ("Salaries & Wages", ["salary", "salaries", "wages", "payroll", "tankhwah", "tankha", "pagar", "majduri", "stipend", "incentive", "तनख्वाह", "वेतन", "पगार", "मजदूरी", "मजुरी"]),
    ("Utilities", ["electricity", "bijli", "water bill", "wifi", "internet", "broadband", "airtel", "jio", "aws", "amazon web", "mongodb", "server", "hosting", "msedcl", "mseb", "recharge", "बिजली", "पानी", "इंटरनेट"]),
    ("Marketing", ["google ads", "meta ads", "meta platforms", "facebook", "instagram", "advert", "marketing", "promotion", "influencer", "hoarding", "pamphlet", "flyer", "cashback", "विज्ञापन", "प्रचार", "जाहिरात"]),
    ("Food & Refreshments", ["chai", "tea", "lunch", "dinner", "snacks", "zomato", "swiggy", "caterer", "catering", "khana", "nashta", "pantry", "चाय", "खाना", "नाश्ता", "जेवण", "चहा"]),
    ("Repairs & Maintenance", ["repair", "maintenance", "servicing", "marammat", "plumber", "मरम्मत", "दुरुस्ती"]),
    ("Taxes & Fees", ["gst", "tax", "tds", "challan", "licence", "license", "filing", "gateway", "razorpay fee", "जीएसटी", "टैक्स", "कर"]),
    ("Raw Material & Stock", ["stock", "maal", "material", "uniform", "kit", "wholesale", "supplies", "inventory", "purchase", "माल", "सामान", "कच्चा"]),
]
INCOME_RULES = [
    ("Services Rendered", ["service", "subscription", "contract", "invoice", "retainer", "सेवा"]),
    ("Other Income", ["interest", "refund", "cashback", "funding", "grant", "dividend", "ब्याज", "व्याज"]),
]
INCOME_WORDS = ["received", "receive", "got ", "earned", "sold", "sale", "credited", "mila", "mili", "mile", "aaya", "aayi", "bika", "becha", "jama", "milale", "मिला", "मिले", "मिली", "आया", "आई", "बेचा", "बिका", "जमा", "मिळाले", "मिळाला", "विकले", "आले", "कमाई"]
EXPENSE_WORDS = ["paid", "pay ", "spent", "bought", "gave", "purchase", "diye", "diya", "kharcha", "kharch", "bhara", "kharida", "dena", "दिए", "दिया", "दिये", "खर्च", "भरा", "खरीदा", "भरले", "दिले", "खर्चा", "खरेदी"]
PAYMENT_RULES = [
    ("UPI", ["upi", "gpay", "google pay", "phonepe", "paytm", "bhim", "यूपीआई", "यू पी आई"]),
    ("Cash", ["cash", "नकद", "कैश", "रोख"]),
    ("Cheque", ["cheque", "check ", "chq", "चेक"]),
    ("Card", ["card", "pos ", "कार्ड"]),
    ("Bank Transfer", ["neft", "imps", "rtgs", "bank", "transfer", "बैंक"]),
]

UNITS = [
    (re.compile(r"^(crore|cr|करोड़|करोड)$"), 1e7), (re.compile(r"^(lakh|lakhs|lac|lacs|लाख)$"), 1e5),
    (re.compile(r"^(thousand|hazaar|hazar|hajar|k|हज़ार|हजार)$"), 1e3), (re.compile(r"^(hundred|sau|सौ|शे)$"), 100),
]
CURRENCY = re.compile(r"^(rs\.?|₹|rupees?|rupaye|rupay|रुपये|रुपए|रुपया|रु\.?)$")
FILLER = {"to", "from", "at", "for", "via", "by", "on", "using", "through", "of", "the", "a", "an", "in", "ko", "se", "ne", "ka", "ki", "ke", "ला", "को", "से", "ने", "का", "की", "के", "कडून", "आज", "कल", "today", "yesterday", "aaj", "kal", "काल"}
VENDOR_MARKERS = {"to", "from", "ko", "se", "को", "से", "ला", "कडून", "at"}
_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def _find(rules, text):
    return next((cat for cat, words in rules if any(w in text for w in words)), None)


def guess_category(text: str, kind: str) -> str:
    s = f" {text.lower()} "
    return (_find(INCOME_RULES, s) or "Sales Revenue") if kind == "income" else (_find(EXPENSE_RULES, s) or "Others")


def guess_payment_mode(text: str, fallback: str = "Cash") -> str:
    return _find(PAYMENT_RULES, f" {text.lower()} ") or fallback


def guess_type(text: str) -> str:
    s = f" {text.lower()} "

    def first(words):
        idx = [s.index(w) for w in words if w in s]
        return min(idx) if idx else float("inf")

    return "income" if first(INCOME_WORDS) < first(EXPENSE_WORDS) else "expense"


def is_type_word(word: str) -> bool:
    return any(w.strip() == word for w in INCOME_WORDS + EXPENSE_WORDS)


def _parse_amount(tokens):
    for i, tok in enumerate(tokens):
        if re.fullmatch(r"\d+(\.\d+)?", tok.lstrip("₹")):
            amount, used = float(tok.lstrip("₹")), {i}
            nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
            for pattern, mult in UNITS:
                if pattern.match(nxt):
                    amount *= mult
                    used.add(i + 1)
                    break
            return round(amount, 2), used
    return None, set()


def parse_spoken_transaction(heard: str, today: date | None = None) -> dict:
    today = today or date.today()
    text = re.sub(r"[,।!?]", " ", heard.translate(_DIGITS)).strip()
    tokens = text.split()
    lower = [t.lower() for t in tokens]
    amount, used = _parse_amount(lower)
    kind = guess_type(text)
    yesterday = re.search(r"\b(yesterday|kal)\b|कल|काल", text, re.I) is not None
    txn_date = (today - timedelta(days=1 if yesterday else 0)).isoformat()

    def clean(i):
        return i not in used and not CURRENCY.match(lower[i]) and not is_type_word(lower[i]) and not re.match(r"^\d", lower[i]) and not _find(PAYMENT_RULES, f" {lower[i]} ")

    def keep(i):
        return clean(i) and lower[i] not in FILLER

    vendor_idx: list[int] = []
    marker = next((i for i, t in enumerate(lower) if t in VENDOR_MARKERS), -1)
    if marker >= 0:
        english = lower[marker] in ("to", "from", "at")
        idx = [marker + 1, marker + 2, marker + 3] if english else [marker - 3, marker - 2, marker - 1]
        stop = re.compile(r"^(for|via|by|on|using|through)$") if english else re.compile(r"^(ko|se|को|से)$")
        vendor_idx = [i for i in idx if 0 <= i < len(tokens) and clean(i) and not stop.match(lower[i]) and lower[i] not in FILLER and not any(p.match(lower[i]) for p, _ in UNITS)]
    if not vendor_idx:
        vendor_idx = [i for i in range(len(tokens)) if keep(i)][:3]
    vendor = " ".join(tokens[i] for i in vendor_idx)
    vendor = vendor[:1].upper() + vendor[1:] if vendor else ""

    return {
        "heard": heard, "type": kind, "amount": amount, "vendor": vendor, "category": guess_category(text, kind),
        "payment_mode": guess_payment_mode(text, "UPI" if kind == "income" else "Cash"), "txn_date": txn_date,
    }
