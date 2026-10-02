import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, HandCoins, Hand, TrendingUp, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import DhanAiMark from "../ai/DhanAiMark.jsx";
import Skeleton from "../common/Skeleton.jsx";
import api from "../../lib/apiClient.js";
import { useI18n } from "../../lib/i18n.jsx";
import { canSpeak, speak, stopSpeaking } from "../../lib/speech.js";

const ICON = { trend: TrendingUp, hand: Hand, wallet: HandCoins, alert: AlertTriangle, check: CheckCircle2 };
const TONE = { gain: "bg-gain-soft text-gain-ink", loss: "bg-loss-soft text-loss", warn: "bg-gold-100 text-gold-700" };

// "Din ka hisaab": a few exact bullets, plus a spoken version (browser text-to-speech) for owners who'd rather listen.
export default function BriefCard() {
  const { t, lang } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  const query = useQuery({ queryKey: ["ai-brief", lang], queryFn: () => api.get("/ai/brief", { params: { lang } }).then((r) => r.data), staleTime: 5 * 60 * 1000 });
  useEffect(() => () => stopSpeaking(), []);

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speak(query.data.script, lang, () => setSpeaking(false));
    }
  };

  return (
    <section className="card flex h-full flex-col p-5 md:p-6" aria-labelledby="brief-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <DhanAiMark size={36} />
          <div>
            <h2 id="brief-title" className="text-lg font-extrabold text-ink">{t("br.title")}</h2>
            {query.data && <p className="text-xs font-semibold text-ink-muted">{t(query.data.mode === "groq" ? "br.groq" : "br.rules")}</p>}
          </div>
        </div>
        {canSpeak && query.data && (
          <button onClick={toggle} aria-pressed={speaking} className="btn-secondary min-h-[40px] px-3 py-2">
            {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />} {speaking ? t("br.stop") : t("br.listen")}
          </button>
        )}
      </div>

      {query.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : query.isError ? (
        <p className="mt-4 text-[15px] text-ink-soft">{t("br.error")}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {query.data.bullets.map((b, i) => {
            const Icon = ICON[b.icon] || TrendingUp;
            return (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[b.tone] || "bg-surface-muted text-ink-soft"}`}><Icon size={16} /></span>
                <span className="text-[15px] font-semibold leading-snug text-ink">{b.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/ask" className="btn-ink mt-5 w-fit">{t("br.ask")}</Link>
    </section>
  );
}
