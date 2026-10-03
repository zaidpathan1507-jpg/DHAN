# End-to-end self-check of the Udhaar flow on an in-memory DB (needs: pip install mongomock httpx).
# Run from backend/:  PYTHONIOENCODING=utf-8 python scripts/smoke_udhaar.py
import os, sys, json, hmac, hashlib
os.environ["REMINDERS_ENABLED"] = "false"
os.environ["GROQ_API_KEY"] = ""  # tests assume the offline rules engine, whatever is in .env
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "whsec_test"
sys.path.insert(0, ".")
import mongomock, pymongo
pymongo.MongoClient = mongomock.MongoClient
def _bw(self, ops, **k):
    for o in ops: self.update_one(o._filter, o._doc)
mongomock.collection.Collection.bulk_write = _bw
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import database as db
from app.services import udhaar_service as u
c = TestClient(app)
tok = c.post("/api/v1/auth/register", json={"name":"O","phone":"9000000001","password":"secret1","business_name":"Gowurk","business_type":"Services","city":"Pune","opening_balance":0}).json()["access_token"]
H = {"Authorization": "Bearer "+tok}
def d(n): return (date.today()+timedelta(days=n)).isoformat()
assert c.patch("/api/v1/auth/business", headers=H, json={"upi_id":"gowurk@okhdfcbank"}).json()["business"]["upi_id"]=="gowurk@okhdfcbank"
assert c.patch("/api/v1/auth/business", headers=H, json={"upi_id":"not a vpa"}).status_code==422
# create + send
a = c.post("/api/v1/receivables", headers=H, json={"kind":"receivable","party":"Kalyani Tech","phone":"98220 11101","email":"acc@kalyani.example.com","amount":100000,"due_date":d(-10),"late_fee_pct":2,"note":"Aug invoice"}).json()
assert a["late_fee"]==round(100000*2/100*10/30,2), a["late_fee"]
r = c.post(f"/api/v1/receivables/{a['id']}/send", headers=H, json={"channels":["email","whatsapp"],"step":"first"}).json()
assert [x["status"] for x in r["results"]]==["simulated","simulated"], r
assert "/pay/" in r["link"]
msgs = c.get(f"/api/v1/receivables/{a['id']}/messages", headers=H).json(); assert len(msgs)==2 and msgs[0]["read"] is False
print("send ok:", msgs[1]["body"][:80])
# public page
pub = c.get("/api/v1/public/udhaar/"+r["link"].split("/pay/")[1]); assert pub.status_code==200, pub.text
P = pub.json(); assert P["outstanding"]==100000 and P["upi_link"].startswith("upi://pay?pa=gowurk%40okhdfcbank") and P["late_fee"]>0, P
tokn = r["link"].split("/pay/")[1]
c.get("/api/v1/public/udhaar/"+tokn)
n = c.get("/api/v1/notifications", headers=H).json(); assert [x["type"] for x in n["items"]]==["viewed"] and n["unread"]==1, n   # one 'viewed' per session
assert c.get(f"/api/v1/receivables/{a['id']}/messages", headers=H).json()[0]["read"] is True
assert c.get("/api/v1/public/udhaar/nope").status_code==404
# promise, note, claim
assert c.post(f"/api/v1/public/udhaar/{tokn}/promise", json={"date":d(-1)}).status_code==422
assert c.post(f"/api/v1/public/udhaar/{tokn}/promise", json={"date":d(3),"note":"after salary"}).status_code==200
c.post(f"/api/v1/public/udhaar/{tokn}/note", json={"text":"Please send the GST invoice"})
c.post(f"/api/v1/public/udhaar/{tokn}/claim", json={"amount":60000,"reference":"UTR123"})
L = c.get("/api/v1/receivables", headers=H).json(); it=L["items"][0]
assert L["claims_waiting"]==1 and it["claim"]["amount"]==60000 and it["promise_date"]==d(3) and it["views"]==1, it
print("types:", [e["type"] for e in it["events"]])
before = c.get("/api/v1/dashboard/overview", headers=H).json()["cash_balance"]["amount"]
res = c.post(f"/api/v1/receivables/{a['id']}/claim", headers=H, json={"accept":True}).json()
assert res["paid_amount"]==60000 and res["outstanding"]==40000 and res["claim"] is None and not res["paid"]
assert c.get("/api/v1/dashboard/overview", headers=H).json()["cash_balance"]["amount"]-before==60000
res = c.post(f"/api/v1/receivables/{a['id']}/payment", headers=H, json={"amount":999999,"mode":"Cheque"}).json()
assert res["paid"] and res["outstanding"]==0 and res["paid_amount"]==100000
assert c.post(f"/api/v1/receivables/{a['id']}/payment", headers=H, json={"amount":1}).status_code==409
# claim rejected path
b = c.post("/api/v1/receivables", headers=H, json={"kind":"receivable","party":"Blue Orchid","phone":"9822011102","amount":50000,"due_date":d(5)}).json()
c.post(f"/api/v1/public/udhaar/{b['link'].split('/pay/')[1]}/claim", json={})
assert c.post(f"/api/v1/receivables/{b['id']}/claim", headers=H, json={"accept":False}).json()["claim"] is None
# send with no contact
nc = c.post("/api/v1/receivables", headers=H, json={"kind":"receivable","party":"Walk-in","amount":500,"due_date":d(1)}).json()
assert c.post(f"/api/v1/receivables/{nc['id']}/send", headers=H, json={"channels":["email"]}).status_code==422
# customers + reliability: history for Kalyani (paid 10 days late) and a prompt payer
db.receivables.insert_one({"business_id": db.users.find_one()["business_id"], "kind":"receivable","party":"Kalyani Tech","phone":"9822011101","amount":80000,"due_date":u.day(date.today()-timedelta(days=60)),"paid":True,"settled_on":u.day(date.today()-timedelta(days=40)),"payments":[],"events":[],"created_at":u.now(),"token":"x1"})
custs = c.get("/api/v1/receivables/customers", headers=H).json(); k=[x for x in custs if x["party"]=="Kalyani Tech"][0]
print("customer:", {x: k[x] for x in ("score","label","avg_days_late","suggested_limit","invoices")})
assert k["avg_days_late"]==15.0 and k["label"] in ("late","risky")
# reminders
rem = c.post("/api/v1/receivables", headers=H, json={"kind":"receivable","party":"Zenith","phone":"9822011105","amount":168000,"due_date":d(-9),"auto_remind":True}).json()
prm = c.post("/api/v1/receivables", headers=H, json={"kind":"receivable","party":"Promised Co","phone":"9822011106","amount":10000,"due_date":d(-9),"auto_remind":True}).json()
c.post(f"/api/v1/public/udhaar/{prm['link'].split('/pay/')[1]}/promise", json={"date":d(4)})
sent1 = u.run_reminders(db); sent2 = u.run_reminders(db)
assert sent1==1 and sent2==0, (sent1, sent2)   # Zenith only: latest step once; promise respected; claim/none skipped
z = [i for i in c.get("/api/v1/receivables", headers=H).json()["items"] if i["party"]=="Zenith"][0]
assert [e["type"] for e in z["events"]][-2:]==["sent","auto_reminder"], z["events"]
print("reminder ok; steps:", db.receivables.find_one({"party":"Zenith"})["steps_sent"], "| body:", db.outbox.find_one({"receivable_id": rem["id"]})["body"][:70])
# razorpay webhook
body = json.dumps({"event":"payment_link.paid","payload":{"payment_link":{"entity":{"id":"plink_1"}},"payment":{"entity":{"amount":16800000}}}}).encode()
db.receivables.update_one({"party":"Zenith"},{"$set":{"razorpay_link_id":"plink_1"}})
assert c.post("/api/v1/webhooks/razorpay", content=body, headers={"X-Razorpay-Signature":"bad"}).status_code==400
sig = hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()
assert c.post("/api/v1/webhooks/razorpay", content=body, headers={"X-Razorpay-Signature":sig}).status_code==200
assert db.receivables.find_one({"party":"Zenith"})["paid"] is True
assert c.get("/api/v1/notifications", headers=H).json()["items"][0]["type"]=="payment_auto"
assert c.post("/api/v1/notifications/read", headers=H).status_code==200 and c.get("/api/v1/notifications", headers=H).json()["unread"]==0
assert c.get("/api/v1/notifications/stream?token=bad").status_code==401
print("ALL OK")
