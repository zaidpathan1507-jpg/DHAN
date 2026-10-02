import { motion } from "framer-motion";
import { AlertTriangle, Check, TrendingUp } from "lucide-react";

import { useI18n } from "../../lib/i18n.jsx";
import LanguageToggle from "../common/LanguageToggle.jsx";
import Logo from "../common/Logo.jsx";

const EASE = [0.16, 1, 0.3, 1];

// Illustrative sample only. Labelled as such on screen; never presented as the user's data.
function SamplePreview() {
  const { t } = useI18n();
  return (
    <div className="relative mt-10 max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
        className="rounded-2xl bg-white p-5 pb-8 shadow-hero"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-muted">{t("common.cash")}</p>
            <p className="num mt-1 text-[28px] font-extrabold leading-none text-ink">₹4,82,350</p>
          </div>
          <span className="chip bg-gain-soft text-gain-ink">
            <TrendingUp size={13} /> +12.4%
          </span>
        </div>
        <svg viewBox="0 0 320 90" className="mt-3 h-20 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="authFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F0B429" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F0B429" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 70 C25 66 40 52 62 56 S104 70 128 48 S176 30 200 38 S250 18 276 22 S308 10 320 6 L320 90 L0 90Z"
            fill="url(#authFill)"
          />
          <path
            d="M0 70 C25 66 40 52 62 56 S104 70 128 48 S176 30 200 38 S250 18 276 22 S308 10 320 6"
            fill="none"
            stroke="#0B1B2B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-3 text-sm">
          <span className="font-semibold text-ink-soft">{t("dash.outlook")}</span>
          <span className="chip bg-gain-soft text-gain-ink">
            <Check size={13} strokeWidth={3} /> {t("status.HEALTHY")}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
        className="relative -mt-3 ml-8 flex items-center gap-3 rounded-2xl bg-gold-500 px-4 py-3 text-ink shadow-hero"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-gold-400">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold">Utilities ₹42,300</p>
          <p className="text-xs font-semibold text-ink/80">8.1× your usual bill</p>
        </div>
      </motion.div>

      <p className="mt-4 text-xs text-white/70">{t("auth.sample")}</p>
    </div>
  );
}

export default function AuthShell({ title1, title2, sub, children }) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.05fr_1fr]">
      <div
        className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex xl:p-16"
        style={{
          // ledger ruling: faint horizontal lines like a bahi-khata page
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 39px, rgba(255,255,255,0.045) 39px 40px)",
        }}
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <Logo tone="light" size={40} />
        </motion.div>

        <div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="max-w-lg text-[44px] font-extrabold leading-[1.08] tracking-tight xl:text-5xl"
          >
            {title1}
            <br />
            <span className="text-gold-400">{title2}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
            className="mt-4 max-w-md text-lg text-white/75"
          >
            {sub}
          </motion.p>
          <SamplePreview />
        </div>

        <p className="text-sm text-white/65">Hack2Ignite 2026 · PS ID FT-05</p>
      </div>

      <div className="flex flex-col p-5 sm:p-10">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
            className="w-full max-w-sm"
          >
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo size={40} />
            </div>
            {children}
          </motion.div>
        </div>
        <ul className="mx-auto hidden max-w-sm space-y-1.5 pb-2 text-sm text-ink-soft lg:block">
          {["auth.proof1", "auth.proof2", "auth.proof3"].map((k) => (
            <li key={k} className="flex items-center gap-2">
              <Check size={15} strokeWidth={3} className="text-gain" /> {t(k)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
