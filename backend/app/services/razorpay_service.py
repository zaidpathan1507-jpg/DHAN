"""Razorpay payment links + webhook verification. Inactive (returns None / False) until keys are in .env."""

import hashlib
import hmac

import requests

from app.core.config import get_settings


def enabled() -> bool:
    s = get_settings()
    return bool(s.razorpay_key_id and s.razorpay_key_secret)


def create_payment_link(*, amount: float, description: str, party: str, phone: str | None, email: str | None, reference: str, callback_url: str) -> dict | None:
    """Returns {"id", "short_url"} or None when Razorpay is not configured / the call fails."""
    s = get_settings()
    if not enabled():
        return None
    customer = {"name": party}
    if phone:
        customer["contact"] = "+91" + "".join(c for c in phone if c.isdigit())[-10:]
    if email:
        customer["email"] = email
    try:
        r = requests.post(
            "https://api.razorpay.com/v1/payment_links",
            auth=(s.razorpay_key_id, s.razorpay_key_secret),
            json={
                "amount": round(amount * 100),
                "currency": "INR",
                "description": description[:200],
                "customer": customer,
                "notify": {"sms": False, "email": False},  # DHAN sends the notifications itself
                "reference_id": reference,
                "callback_url": callback_url,
                "callback_method": "get",
            },
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        return {"id": data["id"], "short_url": data["short_url"]}
    except Exception:
        return None


def verify_webhook(body: bytes, signature: str | None) -> bool:
    secret = get_settings().razorpay_webhook_secret
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def create_order(amount: float, receipt: str) -> dict | None:
    """A Razorpay Order for Checkout. {"id", "amount"} or None when unconfigured / the call fails. Test keys (rzp_test_...) run in test mode."""
    s = get_settings()
    if not enabled():
        return None
    try:
        r = requests.post("https://api.razorpay.com/v1/orders", auth=(s.razorpay_key_id, s.razorpay_key_secret),
                          json={"amount": round(amount * 100), "currency": "INR", "receipt": receipt[:40], "payment_capture": 1}, timeout=15)
        r.raise_for_status()
        d = r.json()
        return {"id": d["id"], "amount": d["amount"]}
    except Exception:
        return None


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Checkout success callback: HMAC-SHA256(order_id|payment_id) with the key secret must equal the signature."""
    s = get_settings()
    if not enabled() or not signature:
        return False
    expected = hmac.new(s.razorpay_key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
