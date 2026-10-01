import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/AuthContext.jsx";

const BUSINESS_TYPES = ["Retail", "Manufacturing", "Services", "Wholesale/Trading", "Food & Beverage", "Other"];

export default function Register() {
  const { register } = useAuth();
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
      await register({ ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <div className="hidden lg:flex flex-col justify-between bg-navy text-white p-12 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dhan-green text-white font-bold">
            D
          </div>
          <span className="text-xl font-bold tracking-tight">DHAN</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="max-w-md"
        >
          <h1 className="text-4xl font-bold leading-tight">
            Set up your
            <br />
            business in minutes.
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            One place for income, expenses, and the insights that matter.
          </p>
        </motion.div>

        <p className="text-xs text-white/30">Hack2Ignite 2026 · PS ID FT-05</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-dhan-green/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dhan-green text-white font-bold">
              D
            </div>
            <span className="text-xl font-bold tracking-tight text-navy">DHAN</span>
          </div>

          <h2 className="text-2xl font-bold text-navy">Create your account</h2>
          <p className="mt-1 text-sm text-navy-soft">Takes less than a minute.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            <Field label="Your Name" value={form.name} onChange={set("name")} placeholder="Zaid Shaikh" />
            <Field label="Phone" value={form.phone} onChange={set("phone")} type="tel" placeholder="98765 43210" />
            <Field
              label="Password"
              value={form.password}
              onChange={set("password")}
              type="password"
              placeholder="At least 6 characters"
            />
            <Field
              label="Business Name"
              value={form.business_name}
              onChange={set("business_name")}
              placeholder="Shree Enterprises"
            />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70 mb-1 block">
                Business Type
              </label>
              <select
                value={form.business_type}
                onChange={set("business_type")}
                className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={set("city")} placeholder="Mumbai" />
              <Field
                label="Opening Balance"
                value={form.opening_balance}
                onChange={set("opening_balance")}
                type="number"
                placeholder="0"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-1">
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-soft">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-dhan-green hover:underline">
              Log in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70 mb-1 block">{label}</label>
      <input
        required
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
      />
    </div>
  );
}
