"""DHAN AI: ask questions about your books in English, Hindi or Hinglish.

Mode "groq": Groq's hosted Llama (OpenAI-compatible API) answers using function calling over ai_tools, so every
figure comes from the user's own records. Mode "rules": with no key (or if Groq fails) a keyword intent router calls the same
tools and writes the answer itself, so the feature always works. Only the user's question, short chat history and
the aggregate figures a tool returns are sent to Groq; raw transaction tables are never uploaded.
"""

import json
import re
import time
from datetime import date

import requests
from pymongo.database import Database

from app.core.config import get_settings
from app.services import ai_tools as tools
from app.services.ai_tools import L
from app.services.insights_service import generate_insights

MAX_TOOL_ROUNDS = 4
SYSTEM = """You are DHAN AI, the financial copilot inside DHAN, an app for small business owners in India.
Rules:
- Get every figure from the tools. Never guess or invent numbers; if the data isn't there, say so plainly.
- Reply in the language the user wrote in (English, Hindi, Marathi, or Hinglish). Write rupees Indian-style (₹1,23,456; use lakh/crore when large).
- Be concise: lead with the direct answer, then at most two useful observations or one next step. The app already shows tables and charts from the tool results, so do not repeat long lists.
- To fix cash problems call propose_cash_plan. It only proposes: never say you have done something; the owner approves each action in the app.
- You only know this business through the tools. For legal or tax-filing questions give general guidance and suggest consulting a CA.
- Today's date is {today}."""


def inr(n: float) -> str:
    """Indian digit grouping: 1234567 -> ₹12,34,567."""
    n = round(n)
    sign, s = ("-" if n < 0 else ""), str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"{sign}₹{s}"


def nice(iso: str) -> str:
    """2026-10-15 -> 15 Oct."""
    return date.fromisoformat(iso[:10]).strftime("%d %b").lstrip("0")


def customers_say(n: int, lang: str) -> str:
    return L(lang, f"{n} customer says" if n == 1 else f"{n} customers say", f"{n} ग्राहक कहते हैं")


def mode() -> dict:
    s = get_settings()
    return {"mode": "groq" if s.groq_api_key else "rules", "model": s.groq_model if s.groq_api_key else None, "stt": "whisper" if s.groq_api_key else "browser", "vision": bool(s.groq_api_key or s.google_vision_api_key)}


def _chat(messages: list[dict], with_tools: bool = True) -> dict:
    s = get_settings()
    body = {"model": s.groq_model, "messages": messages, "temperature": 0.2}
    if with_tools:
        body.update(tools=tools.SCHEMAS, tool_choice="auto")
    for attempt in (1, 2):
        r = requests.post(f"{s.groq_base_url.rstrip('/')}/chat/completions", headers={"Authorization": f"Bearer {s.groq_api_key}"}, json=body, timeout=45)
        if r.status_code == 400 and attempt == 1 and "tool_use_failed" in r.text:
            continue  # Llama occasionally emits a malformed tool call; one retry almost always succeeds
        r.raise_for_status()
        return r.json()["choices"][0]["message"]


def _clean_history(history: list[dict] | None) -> list[dict]:
    out = []
    for m in (history or [])[-8:]:
        if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str) and m["content"].strip():
            out.append({"role": m["role"], "content": m["content"][:1200]})
    return out


# ---------------------------------------------------------------- LLM (Groq) mode
def _llm_answer(db: Database, bid: str, question: str, history: list[dict], lang: str, today: date) -> dict:
    messages = [{"role": "system", "content": SYSTEM.format(today=today.isoformat())}, *history, {"role": "user", "content": question}]
    blocks, trace = {}, []
    for _ in range(MAX_TOOL_ROUNDS):
        msg = _chat(messages)
        calls = msg.get("tool_calls")
        if not calls:
            return {"answer": (msg.get("content") or "").strip(), "blocks": list(blocks.values()), "trace": trace, "mode": "groq"}
        messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
        for call in calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            data, block = tools.run_tool(db, bid, lang, name, args, today)
            trace.append({"tool": name, "args": args})
            if block and name not in blocks:
                blocks[name] = block
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(data, default=str)[:6000]})
    final = _chat(messages + [{"role": "user", "content": "Answer now using what you have."}], with_tools=False)
    return {"answer": (final.get("content") or "").strip(), "blocks": list(blocks.values()), "trace": trace, "mode": "groq"}


# ---------------------------------------------------------------- rules mode
CATEGORY_WORDS = {
    "Marketing": ["marketing", "advert", " ads", "promotion", "influencer", "विज्ञापन", "प्रचार", "जाहिरात"],
    "Salaries & Wages": ["salary", "salaries", "payroll", "wages", "tankhwah", "तनख्वाह", "वेतन", "पगार"],
    "Rent": ["rent", "kiraya", "किराया"],
    "Utilities": ["utilit", "electric", "bijli", "server", "cloud", "aws", "internet", "बिजली"],
    "Raw Material & Stock": ["raw material", "stock", "kits", "supplies", "inventory", "माल"],
    "Transport & Fuel": ["transport", "fuel", "petrol", "diesel", "travel", "परिवहन", "पेट्रोल"],
    "Food & Refreshments": ["food", "chai", "lunch", "pantry", "खाना", "चाय"],
    "Repairs & Maintenance": ["repair", "maintenance", "मरम्मत"],
    "Taxes & Fees": ["tax", "gst", "tds", "gateway", "जीएसटी", "टैक्स"],
}
PERIOD_WORDS = [
    ("last_month", ["last month", "previous month", "pichle mahine", "pichhle mahine", "पिछले महीने", "गत महीने"]),
    ("month", ["this month", "is mahine", "इस महीने", "month so far"]),
    ("yesterday", ["yesterday", "kal ", "कल "]),
    ("today", ["today", "aaj", "आज"]),
    ("7d", ["week", "hafte", "haftey", "हफ्ते", "सप्ताह", "7 days"]),
    ("90d", ["quarter", "3 months", "three months", "teen mahine", "90 days"]),
    ("year", ["this year", "year to date", "ytd", "saal", "साल"]),
]
INTENTS = [
    ("plan", ["what should i do", "what can i do", "what do i do", "how do i fix", "how to fix", "action plan", "make a plan", "suggest", "kya karu", "kya karna", "क्या करूं", "क्या करना", "सुझाव", "उपाय", "योजना", "काय करू"]),
    ("customers", ["pays late", "late payer", "reliab", "risky customer", "slow payer", "देर से चुक", "भरोसेमंद"]),
    ("receivables", ["owe me", "owes me", "owed", "udhaar", "udhar", "baaki", "bakaya", "outstanding", "unpaid", "pending payment", "receivable", "overdue", "बकाया", "उधार", "बाकी", "मिलना"]),
    ("crunch", ["run out", "cash crunch", "runway", "short of cash", "negative", "enough cash", "will i have", "cash flow problem", "paisa khatam", "कैश खत्म", "पैसे खत्म", "कमी"]),
    ("forecast", ["forecast", "predict", "next month", "agle mahine", "आगे", "अगले महीने", "पूर्वानुमान"]),
    ("gst", ["gst", "gstr", "input tax", "itc", "tax payable", "जीएसटी", "कर देय"]),
    ("credit", ["credit", "loan", "cibil", "eligib", "लोन", "क्रेडिट"]),
    ("insights", ["unusual", "anomal", "why", "alert", "insight", "suspicious", "क्यों", "असामान्य"]),
    ("vendors", ["vendor", "supplier", "biggest expense", "top expense", "who did i pay", "kisko", "विक्रेता"]),
    ("spend", ["spend", "spent", "expense", "kharcha", "kharch", "cost", "खर्च", "खर्चा"]),
    ("income", ["income", "revenue", "sales", "earned", "earn", "profit", "kamai", "kamaya", "bikri", "munafa", "आमदनी", "कमाई", "बिक्री", "मुनाफ़ा", "मुनाफा"]),
]


def _detect_period(s: str) -> str:
    for period, words in PERIOD_WORDS:
        if any(w in f" {s} " for w in words):
            return period
    return "30d"


def _detect_category(s: str) -> str | None:
    for cat, words in CATEGORY_WORDS.items():
        if any(w in f" {s} " for w in words):
            return cat
    return None


def _detect_intent(s: str) -> str:
    padded = f" {s} "
    if re.fullmatch(r"\W*(hi|hello|hey|namaste|namaskar|नमस्ते|हेलो)\W*", s):
        return "greeting"
    for intent, words in INTENTS:
        if any(w in padded for w in words):
            return intent
    return "summary"


def _cat_name(c: str, lang: str) -> str:
    hi = {"Marketing": "प्रचार", "Salaries & Wages": "वेतन", "Rent": "किराया", "Utilities": "बिजली-पानी आदि", "Raw Material & Stock": "कच्चा माल", "Transport & Fuel": "परिवहन", "Food & Refreshments": "खान-पान", "Repairs & Maintenance": "मरम्मत", "Taxes & Fees": "कर और शुल्क"}
    return hi.get(c, c) if lang in ("hi", "mr") else c


def _rules_answer(db: Database, bid: str, question: str, lang: str, today: date) -> dict:
    s = question.lower().strip()
    intent, period, category = _detect_intent(s), _detect_period(s), _detect_category(s)
    if intent == "summary" and category:  # "how much rent last month" is a spending question even without the word
        intent = "spend"
    label = tools._label(period, lang)
    trace, blocks = [], []

    def call(name, **args):
        data, block = tools.run_tool(db, bid, lang, name, args, today)
        trace.append({"tool": name, "args": args})
        if block:
            blocks.append(block)
        return data

    if intent == "greeting":
        text = L(lang, "Hi! I'm DHAN AI. Ask me about your spending, income, who owes you, or whether cash will get tight.", "नमस्ते! मैं DHAN AI हूं। अपने खर्च, आमदनी, बकाया या कैश की तंगी के बारे में पूछिए।")
        return {"answer": text, "blocks": [], "trace": [], "mode": "rules"}

    if intent == "receivables":
        d = call("get_receivables")
        if not d["open_count"]:
            text = L(lang, "Nobody owes you anything right now. Everything is settled.", "अभी किसी का कुछ बाकी नहीं है। सब निपट गया है।")
        else:
            top = d["top"][0]
            text = L(lang, f"Customers owe you {inr(d['total_outstanding'])} across {d['open_count']} invoices, and {inr(d['overdue'])} of it is overdue. The most urgent is {top['party']} ({inr(top['outstanding'])}, {top['days_overdue']} days late).",
                     f"ग्राहकों से आपको {d['open_count']} इनवॉइस में {inr(d['total_outstanding'])} मिलना है, जिसमें से {inr(d['overdue'])} देर से हैं। सबसे ज़रूरी {top['party']} ({inr(top['outstanding'])}, {top['days_overdue']} दिन देर) है।")
            if d["claims_waiting_confirmation"]:
                text += L(lang, f" {customers_say(d['claims_waiting_confirmation'], lang)} they've paid; confirm once the money arrives.", f" {customers_say(d['claims_waiting_confirmation'], lang)} कि भुगतान कर दिया; पैसा आने पर पुष्टि करें।")
    elif intent == "plan":
        d = call("propose_cash_plan")
        acts, imp = d["proposed_actions"], d["impact"]
        if not acts:
            text = L(lang, "Nothing needs fixing right now. Cash looks safe and no invoice needs chasing.", "अभी कुछ ठीक करने की ज़रूरत नहीं। कैश सुरक्षित है और किसी इनवॉइस को वसूलने की जल्दी नहीं।")
        else:
            gain = (imp["after_lowest"] - imp["before_lowest"]) if imp else 0
            text = L(lang, f"Here's a plan with {len(acts)} step{'s' if len(acts) != 1 else ''}. Approve any you like and I'll do it for you.", f"यह {len(acts)} कदमों की योजना है। जो ठीक लगे उसे मंज़ूर करें, मैं कर दूंगा।")
            if imp and gain > 0:
                text += L(lang, f" Together they lift your lowest cash point by about {inr(gain)}" + (" and keep you above your safety buffer." if imp["resolves"] else "."), f" मिलाकर ये आपके सबसे निचले कैश स्तर को लगभग {inr(gain)} ऊपर ले जाएंगे" + (" और सुरक्षा बफ़र के ऊपर रखेंगे।" if imp["resolves"] else "।"))
    elif intent == "customers":
        d = call("get_customer_reliability")
        if not d["customers"]:
            text = L(lang, "There's no customer payment history yet.", "अभी ग्राहकों का भुगतान इतिहास नहीं है।")
        else:
            worst = min(d["customers"], key=lambda c: c["score"])
            text = L(lang, f"{worst['customer']} is your riskiest customer (score {worst['score']}, pays about {worst['avg_days_late']} days late on average).", f"{worst['customer']} सबसे जोखिम वाले ग्राहक हैं (स्कोर {worst['score']}, औसतन {worst['avg_days_late']} दिन देर से चुकाते हैं)।")
    elif intent == "crunch":
        d = call("get_cash_calendar")
        if d.get("available") is False:
            text = L(lang, "I need a few more weeks of transactions to project your cash.", "कैश का अनुमान लगाने के लिए कुछ और हफ़्तों के लेन-देन चाहिए।")
        elif d["crunch"]:
            c = d["crunch"]
            text = L(lang, f"Heads up: cash drops below your safety buffer ({inr(d['safety_buffer'])}) on {nice(c['date'])}, about {c['days_away']} days from now. The lowest point is {inr(d['lowest_balance'])}. Chasing overdue invoices is the fastest fix.",
                     f"सावधान: {nice(c['date'])} को (लगभग {c['days_away']} दिन में) आपका कैश सुरक्षा बफ़र ({inr(d['safety_buffer'])}) से नीचे जाएगा। सबसे निचला स्तर {inr(d['lowest_balance'])} है। बकाया वसूलना सबसे तेज़ उपाय है।")
        else:
            text = L(lang, f"You're safe for the next 45 days. Cash stays above your safety buffer; the lowest point is {inr(d['lowest_balance'])} on {nice(d['lowest_on'])}.", f"अगले 45 दिन आप सुरक्षित हैं। कैश सुरक्षा बफ़र से ऊपर रहेगा; सबसे निचला स्तर {nice(d['lowest_on'])} को {inr(d['lowest_balance'])} है।")
    elif intent == "forecast":
        d = call("get_forecast")
        text = (L(lang, f"Expected balance in 30 days is {inr(d['expected_closing_balance_30d'])} (status {d['status'].title()}), between {inr(d['worst_case'])} and {inr(d['best_case'])}.",
                  f"30 दिन बाद अनुमानित बैलेंस {inr(d['expected_closing_balance_30d'])} है, {inr(d['worst_case'])} से {inr(d['best_case'])} के बीच।") if d.get("status")
                else L(lang, "There isn't enough history for a reliable forecast yet.", "भरोसेमंद पूर्वानुमान के लिए अभी पर्याप्त इतिहास नहीं है।"))
    elif intent == "gst":
        d = call("get_gst_summary")
        f = d["filing"]
        text = L(lang, f"For {f['period']} your estimated GST payable is {inr(f['estimated_net_payable'] or 0)}. GSTR-3B is due on {nice(f['gstr3b_due'])} ({f['days_to_gstr3b']} days). "
                       + (f"You could also claim about {inr(d['itc_you_can_claim_with_invoices'])} more input credit if suppliers' GSTINs are added to those bills." if d["itc_you_can_claim_with_invoices"] else "All eligible bills have a GSTIN."),
                 f"{f['period']} के लिए अनुमानित GST देय {inr(f['estimated_net_payable'] or 0)} है। GSTR-3B की अंतिम तिथि {nice(f['gstr3b_due'])} ({f['days_to_gstr3b']} दिन) है। "
                 + (f"आपूर्तिकर्ताओं का GSTIN जोड़ने पर लगभग {inr(d['itc_you_can_claim_with_invoices'])} और इनपुट क्रेडिट मिल सकता है।" if d["itc_you_can_claim_with_invoices"] else "सभी योग्य बिलों पर GSTIN है।"))
    elif intent == "credit":
        d = call("get_credit_readiness")
        text = (L(lang, f"Your credit-readiness score is {d['score']:.0f}/100 ({d['band'].title()}). Biggest opportunity: {d['biggest_opportunity']['label']}.", f"आपका क्रेडिट-तैयारी स्कोर {d['score']:.0f}/100 है। सबसे बड़ा मौका: {d['biggest_opportunity']['label']}।")
                if d.get("score") is not None else L(lang, "Not enough history for a credit-readiness score yet.", "क्रेडिट स्कोर के लिए अभी पर्याप्त इतिहास नहीं है।"))
    elif intent == "insights":
        d = call("get_insights")
        text = (L(lang, "Here is what stands out: ", "ये बातें ध्यान देने लायक हैं: ") + "; ".join(f"{i['title'].lower()} {i['headline']}" for i in d["insights"][:3])) if d["insights"] else L(lang, "Nothing unusual stands out right now.", "अभी कुछ असामान्य नहीं दिख रहा।")
    elif intent == "vendors":
        kind = "income" if any(w in s for w in ["customer", "client", "income", "sales"]) else "expense"
        d = call("get_top_vendors", period=period, type=kind)
        text = (L(lang, f"{d['vendors'][0]['vendor']} is your biggest {'source of income' if kind == 'income' else 'vendor'} {label}: {inr(d['vendors'][0]['amount'])} ({d['vendors'][0]['share_pct']}%).",
                  f"{label} सबसे बड़ा {'आमदनी का स्रोत' if kind == 'income' else 'विक्रेता'} {d['vendors'][0]['vendor']} है: {inr(d['vendors'][0]['amount'])} ({d['vendors'][0]['share_pct']}%)।")
                if d["vendors"] else L(lang, "No transactions in that period.", "उस अवधि में कोई लेन-देन नहीं।"))
    elif intent == "spend":
        d = call("get_spending_by_category", period=period)
        if category:
            row = next((c for c in d["categories"] if c["category"] == category), None)
            blocks[:] = [b for b in blocks if b["type"] != "bars"]
            m = call("search_transactions", category=category, type="expense", period=period)
            text = (L(lang, f"You spent {inr(row['amount'])} on {category} {label}, {row['share_pct']}% of all spending.", f"{label} {_cat_name(category, lang)} पर आपने {inr(row['amount'])} खर्च किए, कुल खर्च का {row['share_pct']}%।")
                    if row else L(lang, f"No {category} spending recorded {label}.", f"{label} {_cat_name(category, lang)} पर कोई खर्च दर्ज नहीं है।"))
        elif d["categories"]:
            top = d["categories"][0]
            text = L(lang, f"You spent {inr(d['total'])} {label}. The biggest category is {top['category']}: {inr(top['amount'])} ({top['share_pct']}%).", f"{label} आपने {inr(d['total'])} खर्च किए। सबसे बड़ी श्रेणी {_cat_name(top['category'], lang)} है: {inr(top['amount'])} ({top['share_pct']}%)।")
        else:
            text = L(lang, "No spending recorded in that period.", "उस अवधि में कोई खर्च दर्ज नहीं है।")
    else:  # income / summary
        d = call("get_summary", period=period)
        change = d["expenses_change_pct_vs_previous"] if intent == "spend" else d["income_change_pct_vs_previous"]
        trend = ""
        if change is not None:
            trend = L(lang, f" Income is {abs(change):.0f}% {'up' if change >= 0 else 'down'} on the previous period.", f" आमदनी पिछली अवधि से {abs(change):.0f}% {'बढ़ी' if change >= 0 else 'घटी'} है।")
        text = L(lang, f"{label.capitalize()} you earned {inr(d['income'])} and spent {inr(d['expenses'])}, a net of {inr(d['net'])}.{trend}", f"{label} आपने {inr(d['income'])} कमाए और {inr(d['expenses'])} खर्च किए; शुद्ध {inr(d['net'])}।{trend}")
    return {"answer": text, "blocks": blocks, "trace": trace, "mode": "rules"}


# ---------------------------------------------------------------- public API
_recent: dict[str, list[float]] = {}


def rate_limited(user_id: str, per_minute: int = 20) -> bool:
    now = time.time()
    hits = [t for t in _recent.get(user_id, []) if now - t < 60]
    _recent[user_id] = hits + [now]
    return len(hits) >= per_minute


def ask(db: Database, bid: str, question: str, history: list[dict] | None, lang: str, today: date | None = None) -> dict:
    today = today or date.today()
    question = question.strip()[:500]
    if get_settings().groq_api_key:
        try:
            out = _llm_answer(db, bid, question, _clean_history(history), lang, today)
            if out["answer"]:
                return out
        except Exception:  # network, auth, quota: fall back rather than fail the user's question
            fallback = _rules_answer(db, bid, question, lang, today)
            fallback["note"] = "ai_error"
            return fallback
    return _rules_answer(db, bid, question, lang, today)


def brief(db: Database, bid: str, lang: str, today: date | None = None) -> dict:
    """'Din ka hisaab': a few bullets (always rule-based, so numbers are exact) plus a spoken script."""
    today = today or date.today()
    b = []
    d, _ = tools.get_summary(db, bid, lang, today, "today")
    label_period = "today"
    if not d["transactions"]:
        d, _ = tools.get_summary(db, bid, lang, today, "yesterday")
        label_period = "yesterday"
    when = L(lang, label_period, "आज" if label_period == "today" else "कल")
    b.append({"icon": "trend", "tone": "gain" if d["net"] >= 0 else "loss", "text": L(lang, f"{when.capitalize()}: {inr(d['income'])} in, {inr(d['expenses'])} out, net {inr(d['net'])}.", f"{when}: {inr(d['income'])} आए, {inr(d['expenses'])} गए, शुद्ध {inr(d['net'])}।")})
    r, _ = tools.get_receivables(db, bid, lang, today)
    if r["claims_waiting_confirmation"]:
        b.append({"icon": "hand", "tone": "warn", "text": L(lang, f"{customers_say(r['claims_waiting_confirmation'], lang).capitalize()} they've paid. Confirm when the money arrives.", f"{customers_say(r['claims_waiting_confirmation'], lang)} भुगतान कर दिया। पैसा आने पर पुष्टि करें।")})
    if r["overdue"]:
        b.append({"icon": "wallet", "tone": "loss", "text": L(lang, f"{inr(r['overdue'])} is overdue. Start with {r['top'][0]['party']}.", f"{inr(r['overdue'])} देर से बाकी है। {r['top'][0]['party']} से शुरू करें।")})
    c, _ = tools.get_cash_calendar_tool(db, bid, lang, today)
    if c.get("crunch"):
        b.append({"icon": "alert", "tone": "loss" if c["crunch"]["level"] == "critical" else "warn", "text": L(lang, f"Cash gets tight around {nice(c['crunch']['date'])}. Chase invoices early.", f"{nice(c['crunch']['date'])} के आसपास कैश तंग होगा। बकाया जल्दी वसूलें।")})
    elif "lowest_balance" in c:
        b.append({"icon": "check", "tone": "gain", "text": L(lang, f"Cash looks safe for 45 days (lowest {inr(c['lowest_balance'])}).", f"45 दिन तक कैश सुरक्षित दिखता है (सबसे निचला {inr(c['lowest_balance'])})।")})
    ins = generate_insights(db, bid)
    if ins:
        b.append({"icon": "alert", "tone": "warn", "text": f"{ins[0]['title'].capitalize()} {ins[0]['headline']}."})
    script = " ".join(x["text"] for x in b)
    out_mode = "rules"
    if get_settings().groq_api_key:
        try:
            msg = _chat([{"role": "system", "content": f"You are DHAN AI. Rewrite these facts as a warm, spoken 2-3 sentence daily update for a shop owner, in {'Hindi' if lang == 'hi' else 'English'}. Keep every number exactly as given. No lists, no emoji."},
                         {"role": "user", "content": script}], with_tools=False)
            if msg.get("content"):
                script, out_mode = msg["content"].strip(), "groq"
        except Exception:
            pass
    return {"bullets": b, "script": script, "mode": out_mode, "date": today.isoformat()}
