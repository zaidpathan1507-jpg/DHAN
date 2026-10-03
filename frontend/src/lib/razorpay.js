import { useState } from "react";

import api from "./apiClient.js";

let loading;
// Razorpay's own Checkout script, loaded on first use.
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve;
    s.onerror = () => { loading = undefined; reject(new Error("checkout-blocked")); };
    document.head.appendChild(s);
  });
  return loading;
}

// Runs one payment through Razorpay Checkout for `base` (/customer/invoices/<id> or /public/udhaar/<token>).
// Calls onDone with {status: "paid", ...} or {status: "failed", reason, ...}; resolves once the customer is finished.
export function useRazorpayPay(base, onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pay = async (amount) => {
    setBusy(true);
    setError(null);
    try {
      const { data: o } = await api.post(`${base}/rzp/order`, { amount });
      await loadCheckout();
      await new Promise((resolve) => {
        let paid = false;
        let lastFailure = null;
        const rzp = new window.Razorpay({
          key: o.key, order_id: o.order_id, amount: o.amount, currency: o.currency, name: o.name, description: o.description, prefill: o.prefill,
          theme: { color: "#F0B429" },
          handler: async (resp) => {
            paid = true;
            try {
              onDone((await api.post(`${base}/rzp/verify`, resp)).data);
            } catch (e) {
              onDone({ status: "failed", reason: "declined", detail: e.response?.data?.detail });
            }
            resolve();
          },
          modal: {
            ondismiss: async () => {
              if (paid) return;
              if (!lastFailure) lastFailure = (await api.post(`${base}/rzp/failed`, { order_id: o.order_id, reason: "cancelled" })).data;
              onDone(lastFailure);
              resolve();
            },
          },
        });
        // A failed attempt is logged straight away (the owner is told), but Checkout stays open so the customer can retry inside it.
        rzp.on("payment.failed", async (r) => {
          try {
            lastFailure = (await api.post(`${base}/rzp/failed`, { order_id: o.order_id, reason: "declined", detail: r.error?.description })).data;
          } catch { /* the owner just won't see this attempt; the customer is not blocked */ }
        });
        rzp.open();
      });
    } catch (e) {
      setError(e.message === "checkout-blocked" ? "blocked" : e.response?.data?.detail || "failed");
    } finally {
      setBusy(false);
    }
  };
  return { pay, busy, error };
}
