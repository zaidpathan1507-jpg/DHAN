# Verify your GROQ_API_KEY end to end against the real database (Gowurk account by default).
# Run from backend/:  python -m scripts.check_groq ["your question"]
# Prints which mode answered, the answer, and which data tools the model called. Never prints the key.
import sys

from app.core.config import get_settings
from app.db.session import database as db
from app.services import dhan_ai

s = get_settings()
print(f"mode: {dhan_ai.mode()}  (key set: {bool(s.groq_api_key)}, base: {s.groq_base_url})")
if not s.groq_api_key:
    sys.exit("GROQ_API_KEY is empty. Add it to backend/.env and run again.")

user = db.users.find_one({"phone": "7410534319"}) or db.users.find_one()
question = sys.argv[1] if len(sys.argv) > 1 else "Who owes me money, and who should I chase first?"
out = dhan_ai.ask(db, user["business_id"], question, [], "en")
print("answered by:", out["mode"], "| note:", out.get("note"))
print("tools called:", [t["tool"] for t in out["trace"]])
print("answer:", out["answer"].encode("ascii", "replace").decode())
if out["mode"] != "groq":
    print("Groq did not answer (the built-in engine did). Check the key, model name, and network.")
