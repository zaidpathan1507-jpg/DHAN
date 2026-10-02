import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/auth/AuthShell.jsx";
import PasswordField from "../components/common/PasswordField.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { BUSINESS_TYPES } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

function Field({ id, label, type = "text", value, onChange, placeholder, inputMode, autoComplete, required = true }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        required={required}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="field"
      />
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const { t, tr } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    business_name: "",
    business_type: BUSINESS_TYPES[0],
    city: "",
    opening_balance: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({
        ...form,
        phone: form.phone.replace(/\s+/g, ""),
        opening_balance: parseFloat(form.opening_balance) || 0,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title1={t("auth.regTitle1")} title2={t("auth.regTitle2")} sub={t("auth.regSub")}>
      <h2 className="text-3xl font-extrabold tracking-tight text-ink">{t("auth.createTitle")}</h2>
      <p className="mt-1.5 text-[15px] text-ink-soft">{t("auth.createSub")}</p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <div role="group" aria-labelledby="grp-you" className="space-y-4">
          <h3 id="grp-you" className="text-base font-extrabold text-ink">{t("auth.about")}</h3>
          <Field id="name" label={t("auth.name")} value={form.name} onChange={set("name")} placeholder="Zaid Shaikh" autoComplete="name" />
          <Field
            id="phone"
            label={t("auth.phone")}
            value={form.phone}
            onChange={set("phone")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
          />
          <PasswordField
            label={t("auth.password")}
            value={form.password}
            onChange={set("password")}
            placeholder={t("auth.passwordHint")}
            autoComplete="new-password"
          />
        </div>

        <div role="group" aria-labelledby="grp-biz" className="space-y-4 pt-3">
          <h3 id="grp-biz" className="text-base font-extrabold text-ink">{t("auth.aboutBiz")}</h3>
          <Field
            id="business_name"
            label={t("auth.bizName")}
            value={form.business_name}
            onChange={set("business_name")}
            placeholder="Shree Enterprises"
            autoComplete="organization"
          />
          <div>
            <label htmlFor="business_type" className="field-label">
              {t("auth.bizType")}
            </label>
            <select id="business_type" value={form.business_type} onChange={set("business_type")} className="field">
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {tr("biz", b)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="city" label={t("auth.city")} value={form.city} onChange={set("city")} placeholder="Mumbai" />
            <Field
              id="opening_balance"
              label={t("auth.openingHint")}
              value={form.opening_balance}
              onChange={set("opening_balance")}
              type="number"
              inputMode="decimal"
              placeholder="0"
              required={false}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-loss-soft px-3.5 py-2.5 text-sm font-semibold text-loss">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t("auth.creating") : t("auth.createBtn")}
        </button>
      </form>

      <p className="mt-6 text-center text-[15px] text-ink-soft">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="link">
          {t("auth.login")}
        </Link>
      </p>
    </AuthShell>
  );
}
