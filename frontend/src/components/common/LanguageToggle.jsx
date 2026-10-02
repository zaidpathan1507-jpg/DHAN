import { useI18n } from "../../lib/i18n.jsx";

const OPTIONS = [
  { key: "en", label: "EN", full: "English" },
  { key: "hi", label: "हि", full: "हिन्दी" },
  { key: "mr", label: "म", full: "मराठी" },
];

export default function LanguageToggle({ tone = "light", className = "" }) {
  const { lang, setLang, t } = useI18n();
  const dark = tone === "dark";

  return (
    <div
      role="radiogroup"
      aria-label={t("common.language")}
      className={`inline-flex rounded-full p-0.5 ${dark ? "bg-white/10" : "bg-surface-muted"} ${className}`}
    >
      {OPTIONS.map((o) => {
        const active = lang === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.full}
            title={o.full}
            onClick={() => setLang(o.key)}
            className={`min-h-[36px] min-w-[40px] rounded-full px-2.5 text-sm font-bold transition-colors ${
              active
                ? dark
                  ? "bg-gold-500 text-ink"
                  : "bg-ink text-white"
                : dark
                ? "text-white/80 hover:text-white"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
