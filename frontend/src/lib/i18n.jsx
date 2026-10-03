import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { en as enBase, hi as hiBase } from "./strings.js";
import { enWow, hiWow } from "./strings.wow.js";
import { enUd, hiUd } from "./strings.udhaar.js";
import { enAi, hiAi } from "./strings.ai.js";
import { enV3, hiV3 } from "./strings.v3.js";
import { enV4, hiV4 } from "./strings.v4.js";
import { mr } from "./strings.mr.js";

const en = { ...enBase, ...enWow, ...enUd, ...enAi, ...enV3, ...enV4 };
const hi = { ...hiBase, ...hiWow, ...hiUd, ...hiAi, ...hiV3, ...hiV4 };

// A language missing a key falls back to English (Marathi: Hindi first), never to a raw key.
const DICTS = { en, hi, mr: { ...hi, ...mr } };
const LOCALES = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
export const LANGS = ["en", "hi", "mr"];
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem("dhan_lang");
    return LANGS.includes(saved) ? saved : "en";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    localStorage.setItem("dhan_lang", next);
    setLangState(next);
  }, []);

  const value = useMemo(() => {
    const locale = LOCALES[lang];
    const t = (key, vars) => {
      let text = DICTS[lang][key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
      }
      return text;
    };
    // Backend values (categories, payment modes, business types) stay English in storage; this is display only.
    const tr = (prefix, value) => {
      const key = `${prefix}.${value}`;
      return DICTS[lang][key] ?? en[key] ?? value;
    };
    const formatDate = (d, opts = { day: "numeric", month: "short" }) => new Date(d).toLocaleDateString(locale, opts);
    return { lang, setLang, locale, t, tr, formatDate };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
