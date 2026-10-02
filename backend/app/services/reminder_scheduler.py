"""Background thread that sends due Udhaar reminders once a minute (see udhaar_service.run_reminders)."""

import threading
import time

from pymongo.database import Database

from app.services.reports_service import run_weekly
from app.services.udhaar_service import run_reminders

INTERVAL_SECONDS = 60


def start(db: Database) -> None:
    def loop():
        while True:
            try:
                run_reminders(db)
                run_weekly(db)
            except Exception:  # keep the thread alive across transient DB/network errors
                pass
            time.sleep(INTERVAL_SECONDS)

    threading.Thread(target=loop, name="udhaar-reminders", daemon=True).start()
