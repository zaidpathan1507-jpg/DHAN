import { Loader2, Mic, Square } from "lucide-react";
import { useState } from "react";

import { useI18n } from "../../lib/i18n.jsx";
import { useVoiceInput } from "../../lib/speech.js";
import { parseSpokenTransaction } from "../../lib/voiceParser.js";

const LANGS = [
  { k: "en", label: "English", ex: "voice.example.en" },
  { k: "hi", label: "हिन्दी", ex: "voice.example.hi" },
  { k: "mr", label: "मराठी", ex: "voice.example.mr" },
];

export default function VoiceCapture({ onParsed }) {
  const { t, lang } = useI18n();
  const [speechLang, setSpeechLang] = useState(lang);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const voice = useVoiceInput(speechLang, (text) => {
    setHeard(text);
    onParsed(parseSpokenTransaction(text));
  });
  const { listening, processing, supported } = voice;
  const live = voice.live || heard;
  const error = voice.error === "mic" ? "voice.blocked" : voice.error ? "voice.failed" : null;

  const example = LANGS.find((l) => l.k === speechLang).ex;

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label={t("voice.speakIn")} className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">{t("voice.speakIn")}</span>
        {LANGS.map((l) => (
          <button
            key={l.k}
            role="radio"
            aria-checked={speechLang === l.k}
            disabled={listening || processing}
            onClick={() => setSpeechLang(l.k)}
            className={`min-h-[40px] rounded-full border px-3.5 text-sm font-bold transition-colors ${
              speechLang === l.k ? "border-ink bg-ink text-white" : "border-surface-strong bg-surface-card text-ink-soft hover:bg-surface-muted"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {supported ? (
        <div className="flex flex-col items-center rounded-2xl bg-surface px-4 py-7 text-center">
          <button
            onClick={listening ? voice.stop : () => { setHeard(""); voice.start(); }}
            disabled={processing}
            aria-label={listening ? t("voice.stop") : t("voice.tap")}
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gold-500 text-ink shadow-elevated transition-transform active:scale-95"
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-gold-500/60" aria-hidden="true" />}
            <span className="relative">{processing ? <Loader2 size={34} className="animate-spin" /> : listening ? <Square size={30} fill="currentColor" /> : <Mic size={38} strokeWidth={2} />}</span>
          </button>
          <p className="mt-4 text-base font-extrabold text-ink">{processing ? t("voice.processing") : listening ? t("voice.listening") : t("voice.tap")}</p>
          <p aria-live="polite" className="mt-2 min-h-[1.75rem] max-w-sm text-lg font-semibold text-ink">
            {live}
          </p>
          {!live && <p className="mt-1 max-w-xs text-sm italic text-ink-muted">“{t(example)}”</p>}
        </div>
      ) : (
        <p className="rounded-xl bg-gold-50 px-4 py-3 text-sm font-semibold text-ink-soft">{t("voice.unsupported")}</p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-loss-soft px-4 py-3 text-sm font-semibold text-loss">
          {t(error)}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onParsed(parseSpokenTransaction(typed));
        }}
      >
        <label htmlFor="voice-typed" className="field-label">
          {t("voice.typeInstead")}
        </label>
        <div className="flex gap-2">
          <input
            id="voice-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t("voice.typePlaceholder")}
            className="field"
          />
          <button type="submit" disabled={!typed.trim()} className="btn-ink shrink-0">
            {t("voice.understand")}
          </button>
        </div>
      </form>
    </div>
  );
}
