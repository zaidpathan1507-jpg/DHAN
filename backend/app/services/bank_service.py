"""Sandbox bank feed: a fake bank that DHAN links to and pulls transactions from, the way a real Account Aggregator
(AA) integration would. Swap `Sandbox` for a real AA/bank API later; everything after `sync()` stays the same.

Flow: link (consent) -> the bank holds a ledger of raw statement lines (UTR, narration like "UPI/CR/412.../ZENITH
RESIDENCY/...") -> sync() parses each line, resolves the counterparty to a known vendor/customer, categorizes it,
settles a matching udhaar when a customer pays, skips lines already on the books, and books the rest as transactions.
"""

import random
import re
from datetime import date, datetime, time, timedelta, timezone
from difflib import SequenceMatcher, get_close_matches

from pymongo import UpdateOne
from pymongo.database import Database

from app.db.session import day, find_txns
from app.services import nl_parser, udhaar_service as u

BANKS = [
    {"key": "sbx_national", "name": "Sandbox National Bank", "ifsc": "SBXN0001001", "code": "SBXN"},
    {"key": "demo_coop", "name": "Demo Co-operative Bank", "ifsc": "DCOP0000042", "code": "DCOP"},
    {"key": "testpay", "name": "TestPay Payments Bank", "ifsc": "TPAY0000007", "code": "TPAY"},
]
HISTORY_DAYS = 45
DRIP_SECONDS = 20  # a "live" account receives a fresh line at most this often
DRIP_CAP = 60

# Used when the business has too little history to imitate.
DEFAULT_DEBITS = [
    ("Sharma Transport", "Transport & Fuel", 800, 4200, "UPI"), ("MSEDCL Electricity", "Utilities", 2400, 9000, "NEFT"),
    ("Airtel Broadband", "Utilities", 1180, 1180, "ECS"), ("Google Ads", "Marketing", 4000, 28000, "CARD"),
    ("Laxmi Wholesale Traders", "Raw Material & Stock", 9000, 64000, "NEFT"), ("Staff Salary Payout", "Salaries & Wages", 18000, 60000, "IMPS"),
    ("Joshi Repairs", "Repairs & Maintenance", 1500, 7500, "UPI"), ("Tea & Snacks Corner", "Food & Refreshments", 300, 1800, "UPI"),
]
DEFAULT_CREDITS = [
    ("Ramesh Kulkarni", "Sales Revenue", 1500, 9000, "UPI"), ("Anjali Traders", "Sales Revenue", 6000, 42000, "NEFT"),
    ("Priya Sharma", "Services Rendered", 800, 6500, "UPI"), ("Sunil Enterprises", "Sales Revenue", 12000, 70000, "IMPS"),
]


def catalog() -> list[dict]:
    return [{"key": b["key"], "name": b["name"], "ifsc": b["ifsc"]} for b in BANKS]


def _bank(key: str) -> dict | None:
    return next((b for b in BANKS if b["key"] == key), None)


def _utr(rng: random.Random) -> str:
    return "".join(str(rng.randrange(10)) for _ in range(12))


def narration(mode: str, kind: str, name: str, ref: str, code: str, note: str = "") -> str:
    n = name.upper()
    if mode == "UPI":
        return f"UPI/{'CR' if kind == 'credit' else 'DR'}/{ref}/{n}/{code}/{note or 'Payment'}"
    if mode in ("NEFT", "IMPS", "RTGS"):
        return f"{mode}/{ref}/{n}"
    if mode == "CARD":
        return f"POS/{n}/{ref}"
    return f"{mode}/{n}/{ref}"


def parse_narration(text: str) -> dict:
    """Raw statement line -> {mode, name, ref}. Understands the common Indian formats (UPI, NEFT, IMPS, POS, ECS)."""
    p = [x.strip() for x in text.split("/")]
    head = p[0].upper()
    if head == "UPI" and len(p) >= 4:
        return {"mode": "UPI", "ref": p[2], "name": p[3]}
    if head in ("NEFT", "IMPS", "RTGS") and len(p) >= 3:
        return {"mode": {"NEFT": "NEFT", "IMPS": "IMPS", "RTGS": "RTGS"}[head], "ref": p[1], "name": p[2]}
    if head == "POS" and len(p) >= 3:
        return {"mode": "Card", "ref": p[2], "name": p[1]}
    if len(p) >= 3:
        return {"mode": "Bank Transfer", "ref": p[2], "name": p[1]}
    return {"mode": "Bank Transfer", "ref": "", "name": text}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", re.split(r"\s[–-]\s", s.lower())[0]).strip()  # "Zenith Society – Home Services" -> "zenith society"


def _known_names(db: Database, bid: str) -> dict[str, dict]:
    """Every counterparty the business already knows: vendor/customer names from the books and udhaar parties."""
    known: dict[str, dict] = {}
    for t in sorted(find_txns(db, {"business_id": bid}), key=lambda t: t.txn_date):  # newest wins
        known[_norm(t.vendor)] = {"name": t.vendor, "category": t.category, "type": t.type}
    for d in db.receivables.find({"business_id": bid}):
        known.setdefault(_norm(d["party"]), {"name": d["party"].split(" – ")[0], "category": None, "type": "income" if d["kind"] == "receivable" else "expense"})
    return known


def resolve(name: str, known: dict[str, dict]) -> dict | None:
    key = _norm(name)
    if key in known:
        return known[key]
    close = get_close_matches(key, list(known), n=1, cutoff=0.82)
    return known[close[0]] if close else None


def _pools(db: Database, bid: str) -> tuple[list, list]:
    """Debit/credit templates (name, category, low, high, mode) imitating this business's own vendors and customers."""
    stats: dict[tuple, list] = {}
    for t in find_txns(db, {"business_id": bid, "txn_date": {"$gte": day(date.today() - timedelta(days=120))}}):
        stats.setdefault((t.type, t.vendor, t.category), []).append(float(t.amount))
    modes = {"expense": "NEFT", "income": "UPI"}
    debits = [(v, c, min(a), max(a), modes["expense"]) for (k, v, c), a in stats.items() if k == "expense" and len(a) >= 2 and not v.lower().startswith("gst payment")]
    credits = [(v, c, min(a), max(a), modes["income"]) for (k, v, c), a in stats.items() if k == "income" and len(a) >= 2]
    return (debits if len(debits) >= 4 else DEFAULT_DEBITS), (credits if len(credits) >= 2 else DEFAULT_CREDITS)


def _line(acc: dict, balance: float, when: date, kind: str, name: str, amount: float, mode: str, note: str, rng: random.Random, origin: str) -> tuple[dict, float]:
    amount = round(float(amount), 2)
    ref = _utr(rng)
    balance = round(balance + (amount if kind == "credit" else -amount), 2)
    return {"account_id": acc["_id"], "business_id": acc["business_id"], "ref": ref, "date": day(when), "kind": kind, "amount": amount, "mode": mode,
            "narration": narration(mode, kind, name, ref, _bank(acc["bank"])["code"], note), "balance_after": balance, "status": "pending", "origin": origin,
            "created_at": datetime.now(timezone.utc)}, balance


def _add_line(db: Database, acc: dict, when: date, kind: str, name: str, amount: float, mode: str, note: str = "", rng: random.Random | None = None, origin: str = "feed") -> dict:
    cur = db.bank_accounts.find_one({"_id": acc["_id"]})["balance"]
    line, bal = _line(acc, cur, when, kind, name, amount, mode, note, rng or random.Random(), origin)
    db.bank_accounts.update_one({"_id": acc["_id"]}, {"$set": {"balance": bal}})
    line["_id"] = db.bank_ledger.insert_one(line).inserted_id
    return line


def link(db: Database, bid: str, holder: str, bank_key: str) -> dict:
    bank = _bank(bank_key)
    if not bank:
        raise ValueError("unknown bank")
    rng = random.Random(f"{bid}:{bank_key}")
    now = datetime.now(timezone.utc)
    acc = {
        "business_id": bid, "bank": bank_key, "holder": holder, "account_no": "".join(str(rng.randrange(10)) for _ in range(12)), "ifsc": bank["ifsc"],
        "balance": float(rng.choice([180000, 240000, 320000, 450000])), "live": True, "status": "active", "drips": 0,
        "consent": {"scope": ["account_details", "transactions"], "granted_at": now, "expires_at": now + timedelta(days=365), "purpose": "Bookkeeping"},
        "last_sync_at": None, "last_drip_at": None, "created_at": now,
    }
    acc["_id"] = db.bank_accounts.insert_one(acc).inserted_id
    debits, credits = _pools(db, bid)
    today, lines, bal = date.today(), [], acc["balance"]
    for back in range(HISTORY_DAYS, 0, -1):
        d = today - timedelta(days=back)
        if d.weekday() == 6 and rng.random() < 0.7:
            continue
        for _ in range(rng.choice([1, 1, 2, 2, 3])):
            kind, pool = ("credit", credits) if rng.random() < 0.42 else ("debit", debits)
            n, _c, lo, hi, mode = rng.choice(pool)
            line, bal = _line(acc, bal, d, kind, n, rng.uniform(lo, hi), mode, "", rng, "feed")
            lines.append(line)
    # Start the account with enough money that the statement never runs it dry, scaled to this business's own flows.
    low = min((l["balance_after"] for l in lines), default=0)
    lift = round(max(0, -low) + 0.35 * sum(l["amount"] for l in lines if l["kind"] == "debit"), 2)
    for l in lines:
        l["balance_after"] = round(l["balance_after"] + lift, 2)
    db.bank_ledger.insert_many(lines)  # one round trip, not one per line
    db.bank_accounts.update_one({"_id": acc["_id"]}, {"$set": {"balance": round(bal + lift, 2)}})
    return db.bank_accounts.find_one({"_id": acc["_id"]})


def drip(db: Database, acc: dict) -> int:
    """A live account receives a fresh statement line now and then, like a real feed ticking in."""
    now = datetime.now(timezone.utc)
    last = acc.get("last_drip_at")
    if not acc.get("live") or acc.get("drips", 0) >= DRIP_CAP or (last and (now - last.replace(tzinfo=timezone.utc)).total_seconds() < DRIP_SECONDS):
        return 0
    rng = random.Random()
    debits, credits = _pools(db, acc["business_id"])
    if rng.random() < 0.45:
        n, _c, lo, hi, mode = rng.choice(credits)
        _add_line(db, acc, date.today(), "credit", n, rng.uniform(lo, hi), mode)
    else:
        n, _c, lo, hi, mode = rng.choice(debits)
        _add_line(db, acc, date.today(), "debit", n, rng.uniform(lo, hi), mode)
    db.bank_accounts.update_one({"_id": acc["_id"]}, {"$set": {"last_drip_at": now}, "$inc": {"drips": 1}})
    return 1


def post_line(db: Database, acc: dict, kind: str, name: str, amount: float, mode: str, note: str = "") -> dict:
    """The 'bank app' side: money moves at the bank (a customer pays you, or you pay someone)."""
    return _add_line(db, acc, date.today(), kind, name, amount, mode, note, origin="bank_app")


def _match_udhaar(db: Database, bid: str, name: str, kind: str, amount: float) -> dict | None:
    """A credit from a customer who owes you (or a debit to a vendor you owe) settles that open udhaar instead of
    being booked twice. Needs a name match and an amount no larger than what is outstanding."""
    want = "receivable" if kind == "credit" else "payable"
    key = _norm(name)
    best, score = None, 0.0
    for d in db.receivables.find({"business_id": bid, "kind": want, "paid": False}):
        pk = _norm(d["party"])
        s = 1.0 if pk == key else SequenceMatcher(None, pk, key).ratio()
        if (key and pk and (key in pk or pk in key)) or s >= 0.82:
            s = max(s, 0.9)
        if s >= 0.82 and s > score and amount <= u.outstanding_of(d) + 0.5:
            best, score = d, s
    return best


def _import_line(db: Database, acc: dict, line: dict, known: dict, seen: set) -> dict:
    bid = acc["business_id"]
    p = parse_narration(line["narration"])
    kind = "income" if line["kind"] == "credit" else "expense"
    hit = resolve(p["name"], known)
    vendor = (hit or {}).get("name") or p["name"].title()
    when = line["date"].date() if isinstance(line["date"], datetime) else line["date"]

    # Only money moved through the bank app settles udhaar; generated history/feed lines are just booked.
    udhaar = _match_udhaar(db, bid, vendor, line["kind"], line["amount"]) if line.get("origin") == "bank_app" else None
    if udhaar:
        after = u.apply_payment(db, udhaar, line["amount"], p["mode"], "bank")
        if udhaar["kind"] == "receivable":
            u.notify(db, bid, "payment_auto", udhaar["_id"], party=udhaar["party"].split(" – ")[0], amount=line["amount"])
        return {"status": "matched", "receivable_id": str(udhaar["_id"]), "party": udhaar["party"], "settled": after["paid"], "vendor": vendor}

    key = (when, round(line["amount"], 2), vendor.lower(), kind)
    if key in seen:
        return {"status": "duplicate", "vendor": vendor}
    seen.add(key)
    category = (hit or {}).get("category") if (hit or {}).get("type") == kind and (hit or {}).get("category") else nl_parser.guess_category(vendor, kind)
    doc = {
        "business_id": bid, "type": kind, "amount": line["amount"], "vendor": vendor, "category": category, "txn_date": day(when), "payment_mode": p["mode"],
        "description": f"Bank sync · UTR {line['ref']}", "gstin": None, "source": "LIVE", "is_anomaly": False, "category_method": "BANK",
        "category_confidence": 90.0 if hit else 70.0, "bank_ref": line["ref"], "created_at": datetime.now(timezone.utc),
    }
    return {"status": "new", "category": category, "vendor": vendor, "_doc": doc}


def sync(db: Database, acc: dict) -> dict:
    """Pull every statement line DHAN has not seen yet and book it. Safe to call as often as you like."""
    bid = acc["business_id"]
    drip(db, acc)
    pending = list(db.bank_ledger.find({"account_id": acc["_id"], "status": "pending"}).sort([("date", 1), ("_id", 1)]))
    known = _known_names(db, bid)
    earliest = min((l["date"] for l in pending), default=None)
    seen = set()
    if earliest:
        seen = {(t.txn_date, float(t.amount), t.vendor.lower(), t.type) for t in find_txns(db, {"business_id": bid, "txn_date": {"$gte": earliest}})}
    out = {"new": 0, "matched": 0, "duplicate": 0}
    matches, new_docs, updates = [], [], []
    for line in pending:
        res = _import_line(db, acc, line, known, seen)
        if res["status"] == "new":
            new_docs.append(res.pop("_doc"))
        out[res["status"]] += 1
        if res["status"] == "matched":
            matches.append({"party": res["party"].split(" – ")[0], "amount": line["amount"], "settled": res["settled"]})
        updates.append(UpdateOne({"_id": line["_id"]}, {"$set": {"status": res["status"], "result": {k: v for k, v in res.items() if k != "status"}}}))
    if new_docs:
        db.transactions.insert_many(new_docs)  # batched: a first sync can be ~80 lines
    if updates:
        db.bank_ledger.bulk_write(updates, ordered=False)
    now = datetime.now(timezone.utc)
    db.bank_accounts.update_one({"_id": acc["_id"]}, {"$set": {"last_sync_at": now}})
    return {**out, "imported": out["new"] + out["matched"], "matches": matches, "synced_at": now}


def serialize(acc: dict) -> dict:
    bank = _bank(acc["bank"])
    return {
        "id": str(acc["_id"]), "bank": bank["name"], "bank_key": acc["bank"], "ifsc": acc["ifsc"], "holder": acc["holder"], "masked": "XXXX" + acc["account_no"][-4:],
        "balance": acc["balance"], "live": acc["live"], "status": acc["status"], "last_sync_at": acc.get("last_sync_at"), "consent": acc["consent"],
    }


def serialize_line(l: dict) -> dict:
    p = parse_narration(l["narration"])
    return {"id": str(l["_id"]), "date": l["date"].date() if isinstance(l["date"], datetime) else l["date"], "kind": l["kind"], "amount": l["amount"], "mode": p["mode"],
            "name": p["name"].title(), "ref": l["ref"], "narration": l["narration"], "balance_after": l["balance_after"], "status": l["status"], "result": l.get("result") or {}}
