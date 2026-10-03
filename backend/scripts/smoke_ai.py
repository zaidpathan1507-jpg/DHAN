# End-to-end self-check of Cash Calendar + DHAN AI on an in-memory DB (needs: pip install mongomock httpx).
# Run from backend/:  PYTHONIOENCODING=utf-8 python scripts/smoke_ai.py
import json
import os
import sys

os.environ["REMINDERS_ENABLED"] = "false"
os.environ["GROQ_API_KEY"] = ""  # tests assume the offline rules engine, whatever is in .env
sys.path.insert(0, ".")
import mongomock, pymongo  # noqa: E402

pymongo.MongoClient = mongomock.MongoClient


def _bw(self, ops, **k):
    for o in ops:
        self.update_one(o._filter, o._doc)


mongomock.collection.Collection.bulk_write = _bw
from datetime import date, timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services import dhan_ai  # noqa: E402

c = TestClient(app)
d = lambda n: (date.today() + timedelta(days=n)).isoformat()  # noqa: E731


def user(phone, seed=True):
    tok = c.post("/api/v1/auth/register", json={"name": "T", "phone": phone, "password": "secret1", "business_name": "Gowurk", "business_type": "Services", "city": "Pune", "opening_balance": 100000}).json()["access_token"]
    h = {"Authorization": "Bearer " + tok}
    if seed:
        c.post("/api/v1/demo/seed", headers=h)
    return h


H = user("9100000001")
E = user("9100000002", seed=False)

# ---- cash calendar
cal = c.get("/api/v1/cash-calendar", headers=H).json()
assert not cal["insufficient_history"] and len(cal["series"]) == 45 and cal["buffer"] > 0, cal.keys()
print("calendar default: lowest", cal["lowest"], "| crunch:", cal["crunch"])
assert c.get("/api/v1/cash-calendar", headers=E).json()["insufficient_history"] is True
c.post("/api/v1/receivables", headers=H, json={"kind": "receivable", "party": "Kalyani", "phone": "9822011101", "amount": 400000, "due_date": d(-20)})
c.post("/api/v1/receivables", headers=H, json={"kind": "receivable", "party": "Blue Orchid", "amount": 250000, "due_date": d(-5)})
c.post("/api/v1/receivables", headers=H, json={"kind": "payable", "party": "AWS", "amount": 120000, "due_date": d(10)})
stress = c.get("/api/v1/cash-calendar", headers=H, params={"sales_pct": -100, "cost_pct": 300}).json()
assert stress["crunch"] and stress["crunch"]["days_away"] >= 1 and stress["rescue"]["items"], stress["crunch"]
assert stress["rescue"]["items"][0]["party"] == "Kalyani", stress["rescue"]  # most overdue first
ev = [e for s in stress["series"] for e in s["events"]]
assert any(e["type"] == "payable" and e["party"] == "AWS" for e in ev) and any(e["type"] == "receivable" for e in ev)
print("stress crunch:", stress["crunch"], "| rescue:", [(i["party"], i["amount"]) for i in stress["rescue"]["items"]])

# ---- DHAN AI, rules mode (no key)
assert c.get("/api/v1/ai/status", headers=H).json()["mode"] == "rules"


def ask(q, lang="en", headers=H, history=()):
    r = c.post("/api/v1/ai/ask", headers=headers, json={"question": q, "lang": lang, "history": list(history)})
    assert r.status_code == 200, r.text
    return r.json()


a = ask("how much did I spend on marketing last month")
assert "Marketing" in a["answer"] and a["mode"] == "rules" and a["trace"][0]["tool"] == "get_spending_by_category", a
a = ask("who owes me money?")
assert "Kalyani" in a["answer"] and a["blocks"][0]["type"] == "metrics" and "table" in a["blocks"][0], a
a = ask("will I run out of cash soon?")
assert a["trace"][0]["tool"] == "get_cash_calendar" and ("safe" in a["answer"] or "Heads up" in a["answer"]), a
a = ask("इस महीने कितनी कमाई हुई", "hi")
assert "आपने" in a["answer"] and a["trace"][0]["tool"] == "get_summary", a
a = ask("मेरा किराया कितना गया पिछले महीने", "hi")
assert a["trace"][0]["tool"] == "get_spending_by_category"
assert "नमस्ते" in ask("hello", "hi")["answer"]
assert "₹" in ask("what's my profit this year")["answer"]
assert ask("who are my biggest vendors")["trace"][0]["tool"] == "get_top_vendors"
assert ask("what's my credit score")["trace"][0]["tool"] == "get_credit_readiness"
print("rules ok:", ask("how much did I earn last 7 days")["answer"])
assert dhan_ai.inr(1234567) == "₹12,34,567" and dhan_ai.inr(-950) == "-₹950" and dhan_ai.inr(100000) == "₹1,00,000"

# tools cannot be pointed at another business
from app.db.session import database as db  # noqa: E402
from app.services import ai_tools  # noqa: E402

other_bid = db.users.find_one({"phone": "9100000002"})["business_id"]
data, _ = ai_tools.run_tool(db, other_bid, "en", "get_summary", {"period": "all", "bid": db.users.find_one({"phone": "9100000001"})["business_id"]})
assert data["transactions"] == 0, data

# brief
b = c.get("/api/v1/ai/brief", headers=H, params={"lang": "en"}).json()
assert b["bullets"] and b["script"] and b["mode"] == "rules", b
print("brief:", b["script"][:140])

# ---- Groq mode with a mocked Groq endpoint: tool call -> tool result -> final answer
os.environ["GROQ_API_KEY"] = "gsk-test"
get_settings.cache_clear()
calls = []


class Resp:
    status_code = 200
    text = ""

    def __init__(self, msg):
        self.msg = msg

    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": self.msg}]}


def fake_post(url, headers=None, json=None, timeout=None):
    calls.append((url, headers, json))
    if not any(m["role"] == "tool" for m in json["messages"]):
        return Resp({"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "get_summary", "arguments": "{\"period\": \"7d\"}"}}]})
    tool_msg = next(m for m in json["messages"] if m["role"] == "tool")
    return Resp({"role": "assistant", "content": "Last week net was " + str(round(__import__("json").loads(tool_msg["content"])["net"])) + "."})


dhan_ai.requests.post = fake_post
st = c.get("/api/v1/ai/status", headers=H).json()
assert st["mode"] == "groq" and st["model"] == "llama-3.3-70b-versatile" and st["stt"] == "whisper"
g = ask("how did last week go?")
assert g["mode"] == "groq" and g["answer"].startswith("Last week net was") and g["blocks"][0]["type"] == "metrics" and g["trace"] == [{"tool": "get_summary", "args": {"period": "7d"}}], g
url, hdr, body = calls[0]
assert url == "https://api.groq.com/openai/v1/chat/completions" and hdr["Authorization"] == "Bearer gsk-test" and body["model"] == "llama-3.3-70b-versatile" and body["tools"]
assert not any("amount" in str(m) for m in body["messages"] if m["role"] == "user")  # question only; figures arrive via tools
print("groq mocked ok:", g["answer"])


# Llama quirk 1: a malformed tool call comes back as HTTP 400 "tool_use_failed"; we retry once and succeed.
state = {"n": 0}


class Bad(Resp):
    status_code = 400
    text = '{"error": {"code": "tool_use_failed"}}'

    def raise_for_status(self):
        raise RuntimeError("400")


def flaky_post(url, headers=None, json=None, timeout=None):
    state["n"] += 1
    if state["n"] == 1:
        return Bad({})
    return fake_post(url, headers, json, timeout)


dhan_ai.requests.post = flaky_post
g2 = ask("how did last week go?")
assert g2["mode"] == "groq" and state["n"] >= 3, (g2, state)

# Llama quirk 2: stringified numbers and nulls in tool arguments are normalised, not fatal.
d, _ = ai_tools.run_tool(db, db.users.find_one({"phone": "9100000001"})["business_id"], "en", "get_top_vendors", {"period": "30d", "limit": "3", "type": None})
assert len(d["vendors"]) == 3, d
d, _ = ai_tools.run_tool(db, db.users.find_one({"phone": "9100000001"})["business_id"], "en", "get_top_vendors", {"limit": "many"})
assert "vendors" in d
print("groq retry + argument coercion ok")

def failing_post(*a, **k):
    raise RuntimeError("network down")


dhan_ai.requests.post = failing_post
fb = ask("who owes me money")
assert fb["mode"] == "rules" and fb["note"] == "ai_error" and "Kalyani" in fb["answer"], fb
b2 = c.get("/api/v1/ai/brief", headers=H).json(); assert b2["mode"] == "rules" and b2["script"]

# validation + rate limit
assert c.post("/api/v1/ai/ask", headers=H, json={"question": "", "lang": "en"}).status_code == 422
assert c.post("/api/v1/ai/ask", headers=H, json={"question": "x" * 600, "lang": "en"}).status_code == 422
codes = [c.post("/api/v1/ai/ask", headers=H, json={"question": "hello"}).status_code for _ in range(25)]
assert 429 in codes, codes
print("ALL OK")
