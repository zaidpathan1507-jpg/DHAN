import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { useI18n } from "../../lib/i18n.jsx";

export default function PasswordField({ label, value, onChange, placeholder, autoComplete = "current-password" }) {
  const [shown, setShown] = useState(false);
  const { t } = useI18n();
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          required
          minLength={6}
          type={shown ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="field pr-12"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? t("common.hidePassword") : t("common.showPassword")}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
