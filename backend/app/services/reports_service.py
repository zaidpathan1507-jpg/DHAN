"""Weekly report: last 7 days vs the 7 before, spending, who owes you, cash outlook, GST deadline, and a short note
written by DHAN AI (Groq when connected, rules otherwise). The same data renders as an in-app page (print to PDF) and
as an email; a Monday-morning job emails it to owners who opted in."""

import html
from datetime import date, datetime, timedelta, timezone

from pymongo.database import Database

from app.core.config import get_settings
from app.services import ai_tools as tools, dhan_ai, gst_service, messaging, udhaar_service as u
from app.services.ai_tools import L
from app.services.insights_service import generate_insights


def weekly_report(db: Database, bid: str, lang: str = "en", today: date | None = None) -> dict:
    today = today or date.today()
    lang = lang if lang in ("en", "hi") else "en"  # Marathi falls back to English for generated prose
    summary, _ = tools.get_summary(db, bid, lang, today, "7d")
    cats, _ = tools.get_spending_by_category(db, bid, lang, today, "7d", "expense", 5)
    vendors, _ = tools.get_top_vendors(db, bid, lang, today, "7d", "expense", 5)
    recv, _ = tools.get_receivables(db, bid, lang, today)
    cal, _ = tools.get_cash_calendar_tool(db, bid, lang, today)
    gst = gst_service.gst_summary(db, bid, 2, today=today)["filing"]
    ins = generate_insights(db, bid)[:3]
    docs = list(db.receivables.find({"business_id": bid, "kind": "receivable"}))
    rec = u.recovered(docs)
    business = db.businesses.find_one({"_id": __import__("bson").ObjectId(bid)}) or {}

    focus = []
    if recv["claims_waiting_confirmation"]:
        focus.append(L(lang, f"Confirm {recv['claims_waiting_confirmation']} payment claim(s) from customers.", f"{recv['claims_waiting_confirmation']} ग्राहकों के भुगतान दावों की पुष्टि करें।"))
    if recv["overdue"]:
        focus.append(L(lang, f"Chase {dhan_ai.inr(recv['overdue'])} that is overdue, starting with {recv['top'][0]['party']}.", f"{dhan_ai.inr(recv['overdue'])} की देर से बाकी रकम वसूलें, {recv['top'][0]['party']} से शुरू करें।"))
    if cal.get("crunch"):
        focus.append(L(lang, f"Cash gets tight around {dhan_ai.nice(cal['crunch']['date'])}. Review the cash calendar.", f"{dhan_ai.nice(cal['crunch']['date'])} के आसपास कैश तंग होगा। कैश कैलेंडर देखें।"))
    if 0 <= gst["days_to_gstr3b"] <= 10:
        focus.append(L(lang, f"GSTR-3B is due in {gst['days_to_gstr3b']} days ({dhan_ai.nice(gst['gstr3b_due'])}).", f"GSTR-3B {gst['days_to_gstr3b']} दिन में देय है ({dhan_ai.nice(gst['gstr3b_due'])})।"))
    if ins:
        focus.append(L(lang, f"Look into: {ins[0]['title'].lower()} {ins[0]['headline']}.", f"देखें: {ins[0]['title'].lower()} {ins[0]['headline']}।"))

    facts = {"week": f"{(today - timedelta(days=6)).isoformat()} to {today.isoformat()}", "income": summary["income"], "expenses": summary["expenses"], "net": summary["net"], "income_change_pct": summary["income_change_pct_vs_previous"],
             "overdue_receivables": recv["overdue"], "top_spend": cats["categories"][:2], "focus": focus}
    note, mode = _note(facts, summary, lang)
    return {
        "business": business.get("name", ""), "from": (today - timedelta(days=6)).isoformat(), "to": today.isoformat(), "lang": lang, "mode": mode, "note": note,
        "metrics": {k: summary[k] for k in ("income", "expenses", "net", "cash_balance_now", "income_change_pct_vs_previous", "expenses_change_pct_vs_previous")},
        "categories": cats["categories"], "vendors": vendors["vendors"], "receivables": {"total": recv["total_outstanding"], "overdue": recv["overdue"], "claims": recv["claims_waiting_confirmation"], "top": recv["top"][:4]},
        "cash": {k: cal.get(k) for k in ("cash_now", "safety_buffer", "lowest_balance", "lowest_on", "crunch")}, "gst": gst, "recovered": rec,
        "insights": [{"title": i["title"], "headline": i["headline"], "body": i["body"]} for i in ins], "focus": focus,
    }


def _note(facts: dict, summary: dict, lang: str) -> tuple[str, str]:
    if get_settings().groq_api_key:
        try:
            msg = dhan_ai._chat([
                {"role": "system", "content": f"You are DHAN AI writing the opening note of a weekly business report for a small-business owner. Write 3 to 4 plain sentences in {'Hindi' if lang == 'hi' else 'English'}: how the week went, the one thing that matters most, and encouragement if deserved. Use ONLY the numbers given, exactly as given, rupees written Indian-style. No bullet points, no emoji."},
                {"role": "user", "content": str(facts)}], with_tools=False)
            if msg.get("content"):
                return msg["content"].strip(), "groq"
        except Exception:
            pass
    inc, exp, net = dhan_ai.inr(summary["income"]), dhan_ai.inr(summary["expenses"]), dhan_ai.inr(summary["net"])
    ch = summary["income_change_pct_vs_previous"]
    trend = "" if ch is None else L(lang, f" Income is {abs(ch):.0f}% {'up' if ch >= 0 else 'down'} on the week before.", f" आमदनी पिछले हफ़्ते से {abs(ch):.0f}% {'बढ़ी' if ch >= 0 else 'घटी'} है।")
    return L(lang, f"This week you brought in {inc} and spent {exp}, a net of {net}.{trend}", f"इस हफ़्ते आपकी आमदनी {inc} और खर्च {exp} रहा; शुद्ध {net}।{trend}"), "rules"


def report_html(r: dict) -> str:
    e, lang = html.escape, r["lang"]
    row = lambda a, b: f'<tr><td style="padding:6px 0;color:#33475B">{e(str(a))}</td><td style="padding:6px 0;text-align:right;font-weight:700">{e(str(b))}</td></tr>'  # noqa: E731
    m = r["metrics"]
    parts = [
        f'<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #E2DFD5;border-radius:16px;overflow:hidden;color:#0B1B2B">',
        f'<div style="background:#0B1B2B;color:#fff;padding:20px 24px"><div style="font-weight:800;letter-spacing:.08em">{e(r["business"])}</div><div style="opacity:.8;font-size:13px">{L(lang, "Weekly report", "साप्ताहिक रिपोर्ट")} · {e(r["from"])} → {e(r["to"])}</div></div>',
        f'<div style="padding:22px 24px"><p style="font-size:15px;line-height:1.6">{e(r["note"])}</p>',
        f'<table style="width:100%;border-collapse:collapse;margin:14px 0">{row(L(lang, "Income", "आमदनी"), dhan_ai.inr(m["income"]))}{row(L(lang, "Expenses", "खर्चे"), dhan_ai.inr(m["expenses"]))}{row(L(lang, "Net", "शुद्ध"), dhan_ai.inr(m["net"]))}{row(L(lang, "Cash in hand", "हाथ में नकद"), dhan_ai.inr(m["cash_balance_now"]))}</table>',
    ]
    if r["focus"]:
        parts.append(f'<h3 style="margin:18px 0 6px">{L(lang, "Focus for next week", "अगले हफ़्ते का ध्यान")}</h3><ul style="padding-left:18px;line-height:1.7">' + "".join(f"<li>{e(f)}</li>" for f in r["focus"]) + "</ul>")
    if r["recovered"]["amount"]:
        parts.append(f'<p style="background:#E2F3EB;border-radius:10px;padding:10px 14px;font-weight:700;color:#0A5A40">{L(lang, "Recovered after DHAN reminders: ", "DHAN की याद के बाद वसूला: ")}{dhan_ai.inr(r["recovered"]["amount"])}</p>')
    parts.append(f'<p style="font-size:12px;color:#566676;margin-top:20px">{L(lang, "Generated by DHAN AI from your own records. Estimates are indicative.", "DHAN AI द्वारा आपके अपने रिकॉर्ड से बनी। अनुमान सांकेतिक हैं।")}</p></div></div>')
    return "".join(parts)


def send_report(db: Database, bid: str, to: str, lang: str = "en") -> dict:
    r = weekly_report(db, bid, lang)
    res = messaging.send_email(to, f"{r['business']} · {L(r['lang'], 'weekly report', 'साप्ताहिक रिपोर्ट')} ({r['from']} → {r['to']})", r["note"], report_html(r))
    return {"status": res["status"], "to": to, "error": res.get("error")}


def run_weekly(db: Database, now: datetime | None = None) -> int:
    """Called every minute by the scheduler: Mondays from 9am, once per ISO week, for owners who opted in."""
    now = now or datetime.now()
    if now.weekday() != 0 or now.hour < 9:
        return 0
    week = f"{now.isocalendar().year}-W{now.isocalendar().week:02d}"
    sent = 0
    for user in db.users.find({"weekly_report": True, "report_email": {"$ne": None}, "last_report_week": {"$ne": week}}):
        db.users.update_one({"_id": user["_id"]}, {"$set": {"last_report_week": week}})  # claim first so a slow send is never repeated
        send_report(db, user["business_id"], user["report_email"], user.get("report_lang", "en"))
        sent += 1
    return sent
