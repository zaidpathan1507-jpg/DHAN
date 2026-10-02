"""Seeds the Gowurk account (home-services + beauty booking marketplace) with ~9 months of founder-side
books so every DHAN screen has real-looking data.

Usage (from backend/):   python -m scripts.seed_gowurk [--dry-run] [--cats]

Idempotent: re-running reuses the account and replaces ALL of that business's transactions.
Deterministic (fixed seed). Transactions are tagged LIVE so they read as the company's own books.
Vendors, handles and GSTINs are synthetic; real brand names appear only for well-known SaaS/ad platforms.
"""

import hashlib
import random
import sys
from datetime import date, datetime, time, timedelta, timezone

T_BOT = "Namaste! Tell me an expense or income, send a bill photo, or ask about your business. Type HELP to see what I can do."
PHONE, PASSWORD, OWNER = "7410534319", "12345678", "Shantanu Kulkarni"
BUSINESS = dict(name="Gowurk", business_type="Services", city="Pune", opening_balance=500000)
DAYS = 270
VERTICALS = {  # booking-commission streams across the 45+ services, weighted by demand
    "Beauty at Home": 14, "Salon for Women": 9, "Men's Grooming": 5, "Bridal & Mehendi": 3,
    "Home Deep Cleaning": 12, "Bathroom Cleaning": 6, "Kitchen Cleaning": 5, "Sofa & Carpet Cleaning": 4,
    "AC Service & Repair": 11, "Plumbing": 6, "Electrician": 6, "Carpenter": 3, "Appliance Repair": 6,
    "Pest Control": 4, "Home Painting": 4, "Massage & Spa": 5, "Physiotherapy at Home": 2,
    "Car Wash & Detailing": 3, "Packers & Movers": 2, "Water Purifier Service": 3,
}
NO_GST_INVOICE = {'iCare Laptop & Device Repairs', 'CoolCare AC Servicing', 'StitchWorks Uniforms & Bags', 'AgroSafe Pest Control Supplies'}  # small suppliers, no GST bill
FOREIGN_BILLED = {  # no GSTIN: invoiced from abroad
    "MongoDB Atlas", "Google Maps Platform", "Google Ads", "Meta Ads", "Twilio", "Firebase", "Datadog", "SaaS Tools",
}

rng = random.Random(7410)
today = date.today()
start = today - timedelta(days=DAYS)
rows: list[dict] = []


def t(d: date) -> float:
    return max(0.0, min(1.0, (d - start).days / DAYS))


def gstin(vendor: str) -> str | None:
    if any(vendor.startswith(f) for f in FOREIGN_BILLED):
        return None
    letters = "".join(c for c in vendor.upper() if c.isalpha())[:5].ljust(5, "X")
    h = int(hashlib.md5(vendor.encode()).hexdigest(), 16)
    return f"27{letters}{h % 10000:04d}{chr(65 + h % 26)}1Z{h % 10}"


def add(kind, amount, vendor, category, d, mode, desc=None, *, anomaly=False, tax_id=True):
    if d > today or d < start:
        return
    rows.append(dict(
        type=kind, amount=round(amount), vendor=vendor, category=category, txn_date=d, payment_mode=mode,
        description=desc, gstin=gstin(vendor) if kind == "expense" and tax_id and vendor not in NO_GST_INVOICE else None, is_anomaly=anomaly,
    ))


def months():
    d = date(start.year, start.month, 1)
    while d <= today:
        yield d
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def on(month: date, day: int) -> date:
    return month + timedelta(days=day - 1)


# ---------------------------------------------------------------- income
weights = list(VERTICALS.values())
for i in range(DAYS + 1):
    d = start + timedelta(days=i)
    factor = [0.9, 0.92, 0.96, 1.0, 1.12, 1.38, 1.32][d.weekday()]
    if date(d.year, 3, 4) <= d <= date(d.year, 3, 9):
        factor *= 1.45  # Women's Day beauty rush
    if d.month in (4, 5, 6):
        factor *= 1.12  # AC-service season
    day_rev = (15000 + 58000 * t(d) ** 1.1) * factor * rng.uniform(0.86, 1.14)
    picks = rng.choices(list(VERTICALS), weights=weights, k=rng.choice([2, 3, 3, 4]))
    picks = list(dict.fromkeys(picks))
    shares = [rng.uniform(0.6, 1.4) for _ in picks]
    for v, s in zip(picks, shares):
        amt = day_rev * s / sum(shares)
        bookings = max(3, round(amt / rng.uniform(190, 330)))
        add("income", amt, f"Razorpay Settlement – {v}", "Sales Revenue", d, "Bank Transfer",
            f"{bookings} bookings settled (T+2) · {v}")

clients = [
    ("Kalyani Tech Park – Housekeeping Contract", 2, 150000), ("Sunrise Co-living – Monthly Maintenance", 3, 95000),
    ("Blue Orchid Hotels – Linen & Deep Cleaning", 4, 185000), ("Aundh Wellness Clinics – Sanitisation", 5, 120000),
    ("Zenith Residency Society – Home Services", 6, 140000),
]
for m in months():
    mi = (m.year - start.year) * 12 + m.month - start.month
    for name, first, base in clients:
        if mi >= first:
            add("income", base * 1.4 * (1 + 0.035 * (mi - first)) * rng.uniform(0.97, 1.03), name, "Services Rendered",
                on(m, rng.randint(5, 11)), rng.choice(["Bank Transfer", "Cheque"]),
                f"Invoice GW/B2B/{m:%Y-%m} · monthly contract")
    if mi >= 2:
        add("income", 26000 * (1 + 0.6 * mi) * rng.uniform(0.9, 1.1), "Sponsored Listings – Local Brands",
            "Other Income", on(m, rng.randint(12, 18)), "Bank Transfer", "Featured-partner placements, brand tie-ups")
    if m.month in (1, 4, 7, 10) and mi >= 1:
        add("income", 9400 + 2100 * mi, "HDFC Bank – FD Interest", "Other Income", on(m, 28), "Bank Transfer",
            "Quarterly interest credit, treasury FD")

d = start + timedelta(days=5)
add("income", 6000000, "Seed Round – Tranche 1 (Angel Syndicate)", "Other Income", d, "Bank Transfer",
    "Equity funding received, board resolution on file")
w = start
while w <= today:
    n_partners = 150 + 1400 * t(w) ** 1.2
    add("income", n_partners * 499 / 4.3 * 1.0 * rng.uniform(0.9, 1.1), "Partner Pro Subscriptions", "Services Rendered",
        w, "UPI", f"~{round(n_partners)} active partners · weekly collections")
    w += timedelta(days=7)

# ---------------------------------------------------------------- expenses
for m in months():
    mi = (m.year - start.year) * 12 + m.month - start.month
    g = 1 + 0.045 * mi
    s = t(m)
    add("expense", 90000 + 14000 * min(mi, 8), "Payroll – Founders", "Salaries & Wages", on(m, 1), "Bank Transfer",
        f"Founder salaries for {(m - timedelta(days=1)):%B}")
    add("expense", 190000 + 20000 * min(mi, 8), "Payroll – Engineering Team", "Salaries & Wages", on(m, 1),
        "Bank Transfer", "Engineering payroll incl. PF/ESI")
    add("expense", 95000 + 10000 * min(mi, 8), "Payroll – Operations & Support", "Salaries & Wages", on(m, 1),
        "Bank Transfer", "Ops, partner success and customer-support payroll")
    add("expense", rng.uniform(28000, 62000), "Contract Designers – Freelance", "Salaries & Wages", on(m, rng.randint(8, 16)),
        "UPI", "App UI and campaign creatives, per-deliverable")
    if mi >= 2:
        add("expense", 40000 + 3000 * mi, "Intern Stipends", "Salaries & Wages", on(m, 5), "UPI", "Product/ops interns")
    if m.month in (3, 6, 9):
        add("expense", 110000 + 20000 * mi, "Variable Incentives – Ops Team", "Salaries & Wages", on(m, 12),
            "Bank Transfer", "Quarterly performance incentives")

    add("expense", 110000 if mi < 4 else 145000, "Co-working Space – Baner, Pune", "Rent", on(m, 3), "Bank Transfer",
        f"Office seats + cabin, {m:%B}")
    if mi >= 3:
        add("expense", 55000, "Partner Training Centre – Wakad", "Rent", on(m, 4), "Bank Transfer",
            "Training hall for beauty and technician onboarding")

    add("expense", (30000 + 55000 * s) * rng.uniform(0.95, 1.06), "Amazon Web Services India", "Utilities", on(m, 5),
        "Card", "EC2, S3, CloudFront, SES")
    add("expense", 28000 + 34000 * min(1, s * 1.5), "MongoDB Atlas (M30 cluster)", "Utilities", on(m, 6), "Card",
        "Primary app database, backups and data transfer")
    add("expense", (14000 + 38000 * s) * rng.uniform(0.92, 1.08), "Google Maps Platform", "Utilities", on(m, 7), "Card",
        "Geocoding, routing and live partner tracking")
    add("expense", (9000 + 29000 * s) * rng.uniform(0.9, 1.1), "Twilio – SMS & WhatsApp API", "Utilities", on(m, 8), "Card",
        "Booking OTPs and reminders")
    add("expense", 6000 + 12000 * s, "Firebase – Auth & Push", "Utilities", on(m, 9), "Card", "FCM + phone auth")
    add("expense", 8000 + 6000 * s, "Datadog – Monitoring", "Utilities", on(m, 10), "Card", "APM and uptime alerts")
    add("expense", 5900, "Airtel Business Fibre", "Utilities", on(m, 14), "UPI", "Office leased line")
    if mi >= 3:
        add("expense", rng.uniform(7000, 12500), "MSEDCL Electricity – Wakad Centre", "Utilities", on(m, 18), "UPI",
            "Electricity bill, training centre")

    add("expense", (60000 * g) * rng.uniform(0.9, 1.1), "Referral Cashback – Wallet Credits", "Marketing", on(m, 25),
        "Bank Transfer", "Customer referral and first-booking credits")
    add("expense", 55000, "SEO Agency – RankHive Digital", "Marketing", on(m, 2), "Bank Transfer", "Monthly retainer, city landing pages")
    add("expense", rng.uniform(14000, 24000) * g, "Society Hoardings & Local Print – Pune", "Marketing", on(m, rng.randint(10, 20)),
        "Cheque", "Housing-society standees, flyers")
    for _ in range(rng.choice([2, 3, 3, 4])):
        handle = rng.choice(["@pune.glam.diaries", "@homechef.shruti", "@thefixitguy.pune", "@bridesofmaharashtra", "@cleanhome.tips", "@punefoodie.ria"])
        add("expense", rng.uniform(15000, 62000) * (0.8 + 0.4 * s), f"Influencer – {handle}", "Marketing",
            on(m, rng.randint(1, 27)), "UPI", "Reels + stories campaign, 2 deliverables")

    add("expense", (rng.uniform(45000, 80000) * g * 0.6 + 60000 * s) * 0.8, "ProGlow Beauty Wholesale", "Raw Material & Stock",
        on(m, rng.randint(3, 9)), "Bank Transfer", "Partner starter kits (facial, waxing, hair)")
    add("expense", rng.uniform(40000, 85000) * (0.5 + 0.7 * s), "ProGlow Beauty Wholesale", "Raw Material & Stock",
        on(m, rng.randint(18, 26)), "Bank Transfer", "Kit refills and consumables for partners")
    add("expense", rng.uniform(25000, 70000) * (0.7 + s), "CleanPro Chemicals & Equipment", "Raw Material & Stock",
        on(m, rng.randint(6, 14)), "Bank Transfer", "Deep-clean chemicals, vacuum and steamers")
    add("expense", rng.uniform(18000, 55000) * (0.8 + s), "StitchWorks Uniforms & Bags", "Raw Material & Stock",
        on(m, rng.randint(10, 20)), "UPI", "Branded partner uniforms and kit bags")
    add("expense", rng.uniform(12000, 30000) * (0.8 + s), "AgroSafe Pest Control Supplies", "Raw Material & Stock",
        on(m, rng.randint(12, 24)), "Bank Transfer", "Pest-control chemicals and sprayers")
    add("expense", rng.uniform(20000, 45000) * (0.8 + s), "ToolMart Pune – Plumbing & Electrical", "Raw Material & Stock",
        on(m, rng.randint(14, 26)), "Cheque", "Tool kits for technician onboarding")

    add("expense", rng.uniform(3500, 8500), "Sharma Logistics – Kit Delivery", "Transport & Fuel", on(m, rng.randint(2, 12)), "UPI", "Tempo for kit distribution")
    add("expense", rng.uniform(4000, 15000), "HP Petrol Pump – Ops Fleet", "Transport & Fuel", on(m, rng.randint(1, 14)), "Card", "Fuel cards, ops bikes")
    add("expense", rng.uniform(4000, 15000), "HP Petrol Pump – Ops Fleet", "Transport & Fuel", on(m, rng.randint(15, 28)), "Card", "Fuel cards, ops bikes")
    add("expense", rng.uniform(18000, 36000) * (0.8 + s), "Rapido Corporate – Field Ops Rides", "Transport & Fuel", on(m, 27), "Bank Transfer", "Monthly ride invoice")

    add("expense", rng.uniform(5000, 11000), "BigBasket – Office Pantry", "Food & Refreshments", on(m, rng.randint(3, 9)), "UPI", "Pantry and refreshments")
    if mi % 3 == 2:
        add("expense", rng.uniform(16000, 26000), "Annapurna Caterers – Town Hall", "Food & Refreshments", on(m, 28), "Bank Transfer", "Quarterly all-hands lunch")

    if rng.random() < 0.6:
        add("expense", rng.uniform(6000, 24000), "iCare Laptop & Device Repairs", "Repairs & Maintenance", on(m, rng.randint(2, 27)), "UPI", "Device repair and screen replacement")
    if mi % 3 == 0:
        add("expense", 8200, "CoolCare AC Servicing", "Repairs & Maintenance", on(m, 15), "UPI", "Quarterly AC servicing, office")
    if mi >= 3 and rng.random() < 0.7:
        add("expense", rng.uniform(9000, 28000), "Wakad Centre – Equipment Servicing", "Repairs & Maintenance", on(m, rng.randint(5, 25)), "Bank Transfer", "Salon chairs, steamers, compressors")

    add("expense", 0, "GST Payment (GSTR-3B)", "Taxes & Fees", on(m, 20), "Bank Transfer", f"GST for {(m - timedelta(days=1)):%B}")  # amount filled below
    add("expense", 0, "Razorpay – Gateway Fees", "Taxes & Fees", on(m, 3), "Bank Transfer", "MDR on collected bookings")  # filled below
    add("expense", 26000 + 6000 * mi, "TDS Payment – Income Tax Dept", "Taxes & Fees", on(m, 7), "Bank Transfer", "Salary + contractor TDS challan")
    add("expense", 2400 + 200 * mi, "Professional Tax – Maharashtra", "Taxes & Fees", on(m, 28), "Bank Transfer", "Monthly PT remittance")

    add("expense", rng.uniform(30000, 46000), "Joshi & Associates – CA & Legal", "Others", on(m, 10), "Bank Transfer", "Monthly bookkeeping, compliance and legal retainer")
    add("expense", 26000 + 14000 * s + rng.uniform(0, 9000), "SaaS Tools – Notion, Slack, Figma, HubSpot", "Others", on(m, 4), "Card", "Team software subscriptions")
    add("expense", rng.uniform(30000, 90000) * (0.6 + s), "Service Recovery Credits – Customer Refunds", "Others", on(m, rng.randint(20, 27)), "Bank Transfer", "Goodwill credits and failed-service refunds")
    add("expense", 25000 + 60000 * s * rng.uniform(0.5, 1.2), "Partner Performance Incentives", "Salaries & Wages", on(m, 22), "UPI", "Top-rated partner bonuses")
    if mi % 3 == 1:
        add("expense", 85000 + 5000 * mi, "Partner Accident Cover – Group Policy", "Others", on(m, 6), "Bank Transfer", "Quarterly insurance premium for partners")
    if rng.random() < 0.5:
        add("expense", rng.uniform(18000, 55000), "Recruitment – Naukri & LinkedIn Hiring", "Others", on(m, rng.randint(2, 25)), "Card", "Job slots for engineers and ops")

# weekly paid media
w = start
while w <= today:
    add("expense", (18000 + 42000 * t(w)) * rng.uniform(0.85, 1.15), "Google Ads – Search & Performance Max", "Marketing", w + timedelta(days=1), "Card", "Weekly spend, search + performance max")
    add("expense", (14000 + 32000 * t(w)) * rng.uniform(0.85, 1.15), "Meta Ads – Instagram & Facebook", "Marketing", w + timedelta(days=3), "Card", "Weekly spend, lead + booking campaigns")
    w += timedelta(days=7)

# one-offs, a few flagged as genuine anomalies
one_offs = [
    (3, "Influencer – Bollywood MUA Campaign", "Marketing", 120000, "UPI", "Flat fee, festive-season launch film", True),
    (9, "Amazon Web Services India – data-transfer overage", "Utilities", 186000, "Card", "Traffic surge after campaign launch", True),
    (23, "Google Ads – Festive Performance Max (overspend)", "Marketing", 210000, "Card", "Budget cap missed, refund requested", True),
    (58, "Emergency Replacement – 4 Laptops", "Repairs & Maintenance", 142000, "Card", "Water damage at office", True),
    (97, "Fire NOC & Shops Act Renewal", "Taxes & Fees", 96000, "Bank Transfer", "Annual licences, training centre", True),
    (141, "Server Migration Consultant", "Others", 175000, "Bank Transfer", "One-time infra migration project", True),
    (80, "Training Centre – Security Deposit", "Rent", 165000, "Bank Transfer", "Refundable deposit, Wakad", False),
    (200, "MCA / ROC Annual Filing", "Taxes & Fees", 18500, "Bank Transfer", "Annual return filing", False),
    (190, "Trademark Registration – IP India", "Taxes & Fees", 15000, "Bank Transfer", "Gowurk word mark, class 35/37/44", False),
    (170, "Google Play & Apple Developer Fees", "Taxes & Fees", 21000, "Card", "Annual developer programme fees", False),
    (35, "Office Furniture – Wakad Centre", "Others", 128000, "Cheque", "Training-hall chairs and tables", False),
    (110, "Team Offsite – Lonavala", "Food & Refreshments", 94000, "Bank Transfer", "Quarterly offsite, 22 people", False),
]
for ago, vendor, cat, amt, mode, desc, flag in one_offs:
    add("expense", amt, vendor, cat, today - timedelta(days=ago), mode, desc, anomaly=flag, tax_id=not vendor.startswith("Google Play"))

# month-dependent taxes derived from the revenue that month
rev_by_month: dict[tuple[int, int], float] = {}
for r in rows:
    if r["type"] == "income" and r["category"] in ("Sales Revenue", "Services Rendered"):
        k = (r["txn_date"].year, r["txn_date"].month)
        rev_by_month[k] = rev_by_month.get(k, 0) + r["amount"]
for r in rows:
    if r["amount"] == 0 and r["category"] == "Taxes & Fees":
        prev = (r["txn_date"].replace(day=1) - timedelta(days=1))
        rev = rev_by_month.get((prev.year, prev.month), rev_by_month.get((r["txn_date"].year, r["txn_date"].month), 0))
        r["amount"] = round(rev * (0.065 if r["vendor"].startswith("GST") else 0.02))
        r["gstin"] = gstin(r["vendor"]) if r["vendor"].startswith("Razorpay") else None
rows = [r for r in rows if r["amount"] > 0]
rows.sort(key=lambda r: r["txn_date"])


def report():
    inc = sum(r["amount"] for r in rows if r["type"] == "income")
    exp = sum(r["amount"] for r in rows if r["type"] == "expense")
    print(f"{len(rows)} transactions | income Rs {inc:,} | expenses Rs {exp:,} | "
          f"closing cash Rs {BUSINESS['opening_balance'] + inc - exp:,} | anomalies flagged {sum(r['is_anomaly'] for r in rows)}")
    by_m: dict[str, list[int]] = {}
    for r in rows:
        by_m.setdefault(f"{r['txn_date']:%Y-%m}", [0, 0])[r["type"] == "expense"] += r["amount"]
    for k, (i, e) in by_m.items():
        print(f"  {k}  income Rs {i:>10,}  expenses Rs {e:>10,}  net Rs {i - e:>10,}")
    if "--cats" in sys.argv:
        cut = today - timedelta(days=30)
        cats: dict[str, int] = {}
        for r in rows:
            if r["txn_date"] > cut:
                key = ("IN " if r["type"] == "income" else "OUT ") + r["category"]
                cats[key] = cats.get(key, 0) + r["amount"]
        for k, v in sorted(cats.items()):
            print(f"  last30 {k:<34} Rs {v:>10,}")


if "--dry-run" in sys.argv:
    report()
    sys.exit(0)

from app.core.security import hash_password  # noqa: E402  (import after data build so --dry-run needs no DB)
from app.db.session import database as db, ensure_indexes  # noqa: E402

ensure_indexes()
now = datetime.now(timezone.utc)
user = db.users.find_one({"phone": PHONE})
if user:
    business_id = user["business_id"]
    from bson import ObjectId
    db.businesses.update_one({"_id": ObjectId(business_id)}, {"$set": BUSINESS})
    db.users.update_one({"_id": user["_id"]}, {"$set": {"name": OWNER, "password_hash": hash_password(PASSWORD)}})
    db.transactions.delete_many({"business_id": business_id})
    print("Existing Gowurk account found: reusing it and replacing its transactions")
else:
    business_id = str(db.businesses.insert_one({**BUSINESS, "created_at": now}).inserted_id)
    db.users.insert_one({"name": OWNER, "phone": PHONE, "password_hash": hash_password(PASSWORD),
                         "business_id": business_id, "created_at": now})
    print("Created Gowurk account")

docs = [
    {
        "business_id": business_id, "type": r["type"], "amount": float(r["amount"]), "vendor": r["vendor"],
        "category": r["category"], "txn_date": datetime.combine(r["txn_date"], time.min), "payment_mode": r["payment_mode"],
        "description": r["description"], "gstin": r["gstin"], "source": "LIVE", "is_anomaly": r["is_anomaly"],
        "category_method": "RULE", "category_confidence": 100.0,
        "created_at": datetime.combine(r["txn_date"], time(rng.randint(8, 21), rng.randint(0, 59)), tzinfo=timezone.utc),
    }
    for r in rows
]
db.transactions.insert_many(docs)

# ---------------------------------------------------------------- Udhaar: receivables, payables, history, live-looking activity
from app.services import udhaar_service as u  # noqa: E402

from bson import ObjectId  # noqa: E402

db.businesses.update_one({"_id": ObjectId(business_id)}, {"$set": {"upi_id": "gowurk@okhdfcbank"}})
for coll in (db.receivables, db.outbox, db.notifications):
    coll.delete_many({"business_id": business_id})
t_now = datetime.now(timezone.utc)


def at(days_ago=0, hours_ago=0):
    return t_now - timedelta(days=days_ago, hours=hours_ago)


def D(offset):
    return datetime.combine(today + timedelta(days=offset), time.min)


def base(kind, party, phone, email, amount, due, note, **kw):
    return {
        "business_id": business_id, "kind": kind, "party": party, "phone": phone, "email": email, "amount": float(amount),
        "due_date": D(due), "note": note, "paid": False, "payments": [], "events": [], "steps_sent": [],
        "token": u.new_token(), "lang": kw.pop("lang", "en"), "late_fee_pct": kw.pop("late_fee_pct", 0), "auto_remind": kind == "receivable",
        "created_at": at(kw.pop("created", 30)), **kw,
    }


def ev(type_, days=0, hours=0, **params):
    return {"type": type_, "at": at(days, hours), "params": params}


def sent(days, step="first", channels=("email", "whatsapp")):
    return [ev("sent", days, channel=c, step=step, status="simulated") for c in channels]


# customers with a payment history: (phone, email, days-late of each invoice they already paid)
history = {
    "Kalyani Tech Park – Housekeeping Contract": ("9822011101", "accounts@kalyanitech.example.com", [6, 9, 12, 8, 11]),
    "Blue Orchid Hotels – Linen & Deep Cleaning": ("9822011102", "finance@blueorchid.example.com", [0, 2, 1, 3]),
    "Aundh Wellness Clinics – Sanitisation": ("9822011103", "admin@aundhwellness.example.com", [28, 41, 35]),
    "SkillUp Academy – Bulk Partner Subscriptions": ("9822011104", "ops@skillup.example.com", [0, 4]),
    "Zenith Residency Society – Home Services": ("9822011105", "committee@zenith.example.com", [1, 0, 2]),
    "Sunrise Co-living – Monthly Maintenance": ("9822011106", "manager@sunrise.example.com", [7, 5]),
}
docs = []
for party, (phone, email, lates) in history.items():
    for i, late in enumerate(lates):
        due = -(60 + 30 * (len(lates) - i)) - 10
        amt = rng.choice([95000, 110000, 128000, 142000, 168000])
        d = base("receivable", party, phone, email, amt, due, f"Invoice GW/B2B/2026-{i + 1:02d}", created=-due + 5)
        d.update(paid=True, settled_on=D(due + late), payments=[{"amount": float(amt), "mode": "Bank Transfer", "at": at(-(due + late)), "source": "owner"}],
                 events=[ev("created", -due + 5), ev("payment", -(due + late), amount=float(amt), mode="Bank Transfer", source="owner"), ev("settled", -(due + late))])
        if late > 3:  # DHAN nudged them, then the money arrived
            d["events"].insert(1, ev("sent", -(due + 2), channel="whatsapp", step="late3", status="simulated"))
            d["events"].insert(2, ev("auto_reminder", -(due + 2), step="late3"))
        docs.append(d)

k = base("receivable", "Kalyani Tech Park – Housekeeping Contract", "9822011101", "accounts@kalyanitech.example.com", 195000, -38, "Invoice GW/B2B/2026-08", created=52, late_fee_pct=2)
k["events"] = [ev("created", 52), *sent(50), ev("viewed", 49), *sent(38, "due"), ev("auto_reminder", 38, step="due"), *sent(35, "late3"), ev("auto_reminder", 35, step="late3"),
               *sent(31, "late7"), ev("auto_reminder", 31, step="late7"), *sent(23, "final"), ev("auto_reminder", 23, step="final")]
k["steps_sent"] = ["pre", "due", "late3", "late7", "final"]

bo = base("receivable", "Blue Orchid Hotels – Linen & Deep Cleaning", "9822011102", "finance@blueorchid.example.com", 231000, -12, "Invoice GW/B2B/2026-09", created=30)
bo["events"] = [ev("created", 30), *sent(28), ev("viewed", 27, 2), *sent(15, "pre"), ev("auto_reminder", 15, step="pre"), *sent(12, "due"), ev("auto_reminder", 12, step="due"),
                ev("viewed", 4), ev("promise", 2, date=(today + timedelta(days=3)).isoformat(), note="after the client pays us")]
bo["promise_date"] = D(3)
bo["steps_sent"] = ["pre", "due", "late3", "late7"]

au = base("receivable", "Aundh Wellness Clinics – Sanitisation", "9822011103", "admin@aundhwellness.example.com", 142500, -71, "Invoice GW/B2B/2026-07", created=90, late_fee_pct=3)
au["events"] = [ev("created", 90), *sent(88), ev("viewed", 87), *sent(71, "due"), ev("auto_reminder", 71, step="due"), *sent(68, "late3"), ev("auto_reminder", 68, step="late3"),
                *sent(64, "late7"), ev("auto_reminder", 64, step="late7"), *sent(56, "final"), ev("auto_reminder", 56, step="final"), ev("viewed", 0, 3),
                ev("claim", 0, 1, amount=142500.0, reference="NEFT UTR 4421907765")]
au["steps_sent"] = ["pre", "due", "late3", "late7", "final"]
au["claim"] = {"amount": 142500.0, "reference": "NEFT UTR 4421907765", "mode": "Bank Transfer", "at": at(0, 1)}

sk = base("receivable", "SkillUp Academy – Bulk Partner Subscriptions", "9822011104", "ops@skillup.example.com", 86000, -5, "200 partner seats, quarterly", created=25)
sk["payments"] = [{"amount": 40000.0, "mode": "UPI", "at": at(3), "source": "customer_claim"}]
sk["events"] = [ev("created", 25), *sent(22), ev("viewed", 21), *sent(5, "due"), ev("auto_reminder", 5, step="due"), ev("claim", 3, 2, amount=40000.0, reference="UPI 6128840021"),
                ev("claim_confirmed", 3, amount=40000.0), ev("payment", 3, amount=40000.0, mode="UPI", source="customer_claim")]
sk["steps_sent"] = ["pre", "due"]

ze = base("receivable", "Zenith Residency Society – Home Services", "9822011105", "committee@zenith.example.com", 168000, 6, "Invoice GW/B2B/2026-09", created=3, lang="hi")
ze["events"] = [ev("created", 3)]
su = base("receivable", "Sunrise Co-living – Monthly Maintenance", "9822011106", "manager@sunrise.example.com", 118000, 14, "Invoice GW/B2B/2026-10", created=2)
su["events"] = [ev("created", 2), *sent(1, channels=("whatsapp",))]
gk = base("receivable", "GlowKart Brands – Sponsored Listing", "9822011107", None, 64000, 20, "Festive placement package", created=1)
gk["events"] = [ev("created", 1)]
docs += [k, bo, au, sk, ze, su, gk]

for party, amt, due, note in [
    ("CleanPro Chemicals & Equipment", 46200, -3, "Deep-clean chemical order"), ("Joshi & Associates – CA Fees", 38000, 2, "Monthly retainer"),
    ("ProGlow Beauty Wholesale", 78500, 4, "Partner kit refills"), ("Amazon Web Services India", 112340, 9, "September cloud bill"),
    ("Google Ads – Monthly Invoice", 240000, 12, "Festive campaign"), ("StitchWorks Uniforms & Bags", 28600, 18, "Partner uniforms"),
]:
    p_ = base("payable", party, None, None, amt, due, note, created=20)
    p_["events"] = [ev("created", 20)]
    docs.append(p_)

result = db.receivables.insert_many(docs)
for doc, _id in zip(docs, result.inserted_ids):  # outbox: what each "sent" event actually put in front of the customer
    doc["_id"] = _id
    for e in (e for e in doc["events"] if e["type"] == "sent"):
        subject, body = u.render_message(doc, BUSINESS["name"], e["params"]["step"], doc["lang"], today)
        db.outbox.insert_one({
            "business_id": business_id, "receivable_id": str(_id), "channel": e["params"]["channel"],
            "to": doc["email"] if e["params"]["channel"] == "email" else doc["phone"], "subject": subject, "body": body,
            "step": e["params"]["step"], "status": "simulated", "provider": "simulated", "created_at": e["at"],
        })
open_id = {d["party"]: str(d["_id"]) for d in docs if not d["paid"]}
db.notifications.insert_many([
    {"business_id": business_id, "type": "viewed", "receivable_id": open_id[k["party"]], "params": {"party": "Kalyani Tech Park", "amount": 195000.0}, "at": at(49), "read": True},
    {"business_id": business_id, "type": "promise", "receivable_id": open_id[bo["party"]], "params": {"party": "Blue Orchid Hotels", "date": (today + timedelta(days=3)).isoformat(), "amount": 231000.0}, "at": at(2), "read": True},
    {"business_id": business_id, "type": "viewed", "receivable_id": open_id[au["party"]], "params": {"party": "Aundh Wellness Clinics", "amount": 142500.0}, "at": at(0, 3), "read": False},
    {"business_id": business_id, "type": "claim", "receivable_id": open_id[au["party"]], "params": {"party": "Aundh Wellness Clinics", "amount": 142500.0, "reference": "NEFT UTR 4421907765"}, "at": at(0, 1), "read": False},
])


# ---------------------------------------------------------------- security, activity, bot chat, loan application
from app.core.security import hash_password  # noqa: E402

db.users.update_one({"phone": PHONE}, {"$set": {"role": "owner"}})
if not db.users.find_one({"phone": "9000000042"}):
    db.users.insert_one({"name": "Meera Joshi (CA)", "phone": "9000000042", "password_hash": hash_password("12345678"), "business_id": business_id, "role": "accountant", "created_at": at(40)})
db.audit.delete_many({"business_id": business_id})
db.audit.insert_many([
    {"business_id": business_id, "user_id": "", "user_name": who, "role": role, "action": action, "detail": detail, "at": at(days, hours)}
    for who, role, action, detail, days, hours in [
        ("Shantanu Kulkarni", "owner", "auth.login", {}, 0, 2), ("Shantanu Kulkarni", "owner", "udhaar.send", {"party": "Zenith Residency Society", "channels": ["email", "whatsapp"], "step": "first"}, 0, 5),
        ("Meera Joshi (CA)", "accountant", "auth.login", {}, 1, 3), ("Shantanu Kulkarni", "owner", "ai.action", {"type": "send_reminders", "status": "executed"}, 2, 1),
        ("Shantanu Kulkarni", "owner", "udhaar.claim_confirmed", {"party": "SkillUp Academy", "amount": 40000}, 3, 0), ("Shantanu Kulkarni", "owner", "passport.create", {"label": "HDFC Bank, Baner branch", "days": 7}, 4, 6),
        ("Shantanu Kulkarni", "owner", "transaction.import", {"imported": 16, "skipped": 0}, 6, 2), ("Shantanu Kulkarni", "owner", "team.add", {"name": "Meera Joshi (CA)", "role": "accountant"}, 40, 0),
    ]
])
db.bot_messages.delete_many({"business_id": business_id})
db.bot_messages.insert_one({"business_id": business_id, "role": "bot", "kind": "text", "text": T_BOT, "at": at(0, 0)})
db.loan_applications.delete_many({"business_id": business_id})
db.passports.delete_many({"business_id": business_id})
tok = u.new_token()
db.passports.insert_one({"business_id": business_id, "token": tok, "label": "Udyam Capital (loan application)", "created_at": at(0, 1), "expires_at": at(-29), "revoked": False, "views": 1})
db.loan_applications.insert_one({
    "business_id": business_id, "lender_id": "udyam-capital", "lender_name": "Udyam Capital", "product": "Working capital loan", "amount": 600000, "tenure": 12, "rate": 14.8, "fee_pct": 1.5,
    "emi": 53650, "status": "approved", "decision": {"by": "auto", "amount": 600000, "rate": 14.8, "tenure": 12}, "passport_token": tok, "created_at": at(0, 1),
    "events": [{"stage": "submitted", "at": at(0, 1)}, {"stage": "reviewing", "at": at(0, 1)}, {"stage": "approved", "at": at(0, 0)}],
})
db.notifications.insert_one({"business_id": business_id, "type": "loan_approved", "receivable_id": "", "params": {"lender": "Udyam Capital", "amount": 600000, "rate": 14.8}, "at": at(0, 0), "read": False})

report()
print(f"Done. Log in with phone {PHONE}.")
