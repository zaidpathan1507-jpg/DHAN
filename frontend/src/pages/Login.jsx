import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(phone, password);
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
            Know your money.
            <br />
            Grow your business.
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            Turn everyday transactions into clear financial decisions.
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
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dhan-green text-white font-bold">
              D
            </div>
            <span className="text-xl font-bold tracking-tight text-navy">DHAN</span>
          </div>

          <h2 className="text-2xl font-bold text-navy">Welcome back</h2>
          <p className="mt-1 text-sm text-navy-soft">Log in to see where your money is going.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70 mb-1 block">
                Phone
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
                placeholder="98765 43210"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy-soft/70 mb-1 block">
                Password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface-card px-3.5 py-2.5 text-sm text-navy focus:border-dhan-green outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-navy-soft">
            New to DHAN?{" "}
            <Link to="/register" className="font-semibold text-dhan-green hover:underline">
              Create an account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
