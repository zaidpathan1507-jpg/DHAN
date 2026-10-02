"""Outbound email + WhatsApp. Each sender returns {"status": "sent"|"simulated"|"failed", "provider": ...}.

With no credentials configured the sender is "simulated": nothing leaves the machine, the caller still records the
message in the outbox, and the UI shows it on a simulated customer phone. Add credentials to .env and the same
call sends for real; no code changes.
"""

import smtplib
from email.message import EmailMessage

import requests

from app.core.config import get_settings


def whatsapp_number(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return "91" + digits if len(digits) == 10 else digits


def send_email(to: str, subject: str, text: str, html: str) -> dict:
    s = get_settings()
    if not s.smtp_host:
        return {"status": "simulated", "provider": "simulated"}
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, s.smtp_from or s.smtp_user, to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as server:
            server.starttls()
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password or "")
            server.send_message(msg)
        return {"status": "sent", "provider": "smtp"}
    except Exception as exc:  # network/auth problems must not break the request
        return {"status": "failed", "provider": "smtp", "error": str(exc)[:200]}


def send_whatsapp(phone: str, text: str) -> dict:
    s = get_settings()
    if not (s.whatsapp_token and s.whatsapp_phone_id):
        return {"status": "simulated", "provider": "simulated"}
    # Note: business-initiated messages outside a 24h customer window must use an approved template in Meta's console.
    try:
        r = requests.post(
            f"https://graph.facebook.com/v20.0/{s.whatsapp_phone_id}/messages",
            headers={"Authorization": f"Bearer {s.whatsapp_token}"},
            json={"messaging_product": "whatsapp", "to": whatsapp_number(phone), "type": "text", "text": {"body": text, "preview_url": True}},
            timeout=15,
        )
        r.raise_for_status()
        return {"status": "sent", "provider": "whatsapp-cloud"}
    except Exception as exc:
        return {"status": "failed", "provider": "whatsapp-cloud", "error": str(exc)[:200]}
