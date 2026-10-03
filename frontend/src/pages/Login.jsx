import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/auth/AuthShell.jsx";
import PasswordField from "../components/common/PasswordField.jsx";
import api from "../lib/apiClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useI18n } from "../lib/i18n.jsx";

const clean = (p) => p.replace(/\s+/g, "");

// In demo mode (no WhatsApp provider configured) the code is shown on a simulated phone instead of being sent.
function DemoCode({ code }) {
  const { t } = useI18n();
  return (
    <div className="mt-5 rounded-2xl bg-[#ECE5DD] p-3">
      <p className="mb-2 text-xs font-bold text-[#667781]">{t("auth.demoNote")}</p>
      <p className="max-w-[90%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[14px] text-[#111B21] shadow-[0_1px_1px_rgba(0,0,0,0.13)]">{t("auth.demoCode", { code })}</p>
    </div>
  );
}

export default function Login() {
  const { login, verifyOtp } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState("password"); // password | otp
  const [step, setStep] = useState("phone"); // phone | code
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fail = (err) => setError(err.response?.status === 429 ? t("auth.locked") : err.response?.data?.detail || t("auth.genericError"));

  const requestCode = async () => {
    const { data } = await api.post("/auth/otp/request", { phone: clean(phone) });
    setDemoCode(data.demo_code);
    setStep("code");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (step === "code") {
        await verifyOtp(clean(phone), code);
        navigate("/dashboard");
      } else if (mode === "otp") {
        await requestCode();
      } else {
        const second = await login(clean(phone), password);
        if (second) {
          setDemoCode(second.demo_code);
          setStep("code");
        } else navigate("/dashboard");
      }
    } catch (err) {
      setError(step === "code" ? t("auth.codeWrong") : "");
      if (step !== "code") fail(err);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setStep("phone");
    setError("");
    setCode("");
    setDemoCode(null);
  };

  const onCodeStep = step === "code";

  return (
    <AuthShell title1={t("auth.tagline1")} title2={t("auth.tagline2")} sub={t("auth.sub")}>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink">{onCodeStep ? t("auth.otpTitle") : t("auth.welcome")}</h2>
      <p className="mt-1.5 text-[15px] text-ink-soft">{onCodeStep ? t("auth.otpSub", { phone: clean(phone) }) : t("auth.welcomeSub")}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {!onCodeStep && (
          <div>
            <label htmlFor="phone" className="field-label">{t("auth.phone")}</label>
            <div className="flex">
              <span className="flex items-center rounded-l-xl border border-r-0 border-surface-strong bg-surface-muted px-3 text-base font-bold text-ink-soft">+91</span>
              <input id="phone" required type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} className="field rounded-l-none" placeholder="98765 43210" />
            </div>
          </div>
        )}

        {!onCodeStep && mode === "password" && (
          <PasswordField label={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        )}

        {onCodeStep && (
          <>
            <div>
              <label htmlFor="otp" className="field-label">{t("auth.code")}</label>
              <input id="otp" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{4,8}" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="field num text-center text-2xl font-extrabold tracking-[0.35em]" placeholder="••••••" />
            </div>
            {demoCode && <DemoCode code={demoCode} />}
          </>
        )}

        {error && <p role="alert" className="rounded-xl bg-loss-soft px-3.5 py-2.5 text-sm font-semibold text-loss">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t("auth.loggingIn") : onCodeStep ? t("auth.verify") : mode === "otp" ? t("auth.sendCode") : t("auth.login")}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        {onCodeStep ? (
          <button
            type="button"
            className="link"
            onClick={async () => {
              setError("");
              setCode("");
              try {
                if (mode === "otp") await requestCode();
                else { setStep("phone"); setDemoCode(null); } // two-step login: re-enter the password to get a fresh code
              } catch (err) {
                fail(err);
              }
            }}
          >
            {t("auth.resend")}
          </button>
        ) : mode === "password" ? (
          <button onClick={() => switchMode("otp")} type="button" className="link inline-flex items-center gap-1.5"><MessageCircle size={15} /> {t("auth.useCode")}</button>
        ) : (
          <button onClick={() => switchMode("password")} type="button" className="link">{t("auth.usePassword")}</button>
        )}
      </div>

      <p className="mt-6 text-center text-[15px] text-ink-soft">
        {t("auth.newHere")}{" "}
        <Link to="/register" className="link">{t("auth.create")}</Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link to="/customer/register" className="link">{t("auth.customerLink")}</Link>
      </p>
    </AuthShell>
  );
}
