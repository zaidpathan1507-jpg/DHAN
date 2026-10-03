import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../../components/auth/AuthShell.jsx";
import PasswordField from "../../components/common/PasswordField.jsx";
import api from "../../lib/apiClient.js";
import { useAuth } from "../../lib/AuthContext.jsx";
import { useI18n } from "../../lib/i18n.jsx";

const clean = (p) => p.replace(/\s+/g, "");

// Customers prove they own the phone number (a one-time code) so nobody can look up someone else's dues.
export default function CustomerRegister() {
  const { t } = useI18n();
  const { acceptToken } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("phone");
  const [form, setForm] = useState({ name: "", phone: "", password: "", code: "" });
  const [demoCode, setDemoCode] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === "phone") {
        const { data } = await api.post("/auth/customer/otp", { phone: clean(form.phone) });
        setDemoCode(data.demo_code);
        setStep("code");
      } else {
        const { data } = await api.post("/auth/customer/register", { phone: clean(form.phone), code: form.code, name: form.name.trim(), password: form.password });
        await acceptToken(data.access_token);
        navigate("/c");
      }
    } catch (err) {
      setError(err.response?.data?.detail || t("auth.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title1={t("cu.reg.title")} title2="" sub={t("cu.reg.sub")}>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink">{t("cu.reg.heading")}</h2>
      <p className="mt-1.5 text-[15px] text-ink-soft">{step === "code" ? t("cu.reg.codeSub", { phone: clean(form.phone) }) : t("cu.reg.why")}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {step === "phone" ? (
          <div>
            <label htmlFor="cphone" className="field-label">{t("auth.phone")}</label>
            <div className="flex">
              <span className="flex items-center rounded-l-xl border border-r-0 border-surface-strong bg-surface-muted px-3 text-base font-bold text-ink-soft">+91</span>
              <input id="cphone" required type="tel" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={set("phone")} className="field rounded-l-none" placeholder="98765 43210" />
            </div>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="ccode" className="field-label">{t("auth.code")}</label>
              <input id="ccode" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "") }))} className="field num text-center text-2xl font-extrabold tracking-[0.35em]" placeholder="••••••" />
            </div>
            {demoCode && (
              <div className="rounded-2xl bg-[#ECE5DD] p-3">
                <p className="mb-2 text-xs font-bold text-[#667781]">{t("auth.demoNote")}</p>
                <p className="max-w-[90%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[14px] text-[#111B21] shadow-[0_1px_1px_rgba(0,0,0,0.13)]">{t("auth.demoCode", { code: demoCode })}</p>
              </div>
            )}
            <div>
              <label htmlFor="cname" className="field-label">{t("cu.reg.name")}</label>
              <input id="cname" required minLength={2} value={form.name} onChange={set("name")} autoComplete="name" className="field" />
            </div>
            <PasswordField label={t("cu.reg.password")} value={form.password} onChange={set("password")} placeholder="••••••••" />
          </>
        )}

        {error && <p role="alert" className="rounded-xl bg-loss-soft px-3.5 py-2.5 text-sm font-semibold text-loss">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{step === "phone" ? t("cu.reg.sendCode") : t("cu.reg.create")}</button>
      </form>

      <p className="mt-6 text-center text-[15px] text-ink-soft">{t("cu.reg.haveAcc")} <Link to="/login" className="link">{t("auth.login")}</Link></p>
    </AuthShell>
  );
}
