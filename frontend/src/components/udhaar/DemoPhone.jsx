import { localizeLink } from "../../lib/links.js";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";

import api from "../../lib/apiClient.js";
import { useAuth } from "../../lib/AuthContext.jsx";
import { useI18n } from "../../lib/i18n.jsx";

const linkRe = /(https?:\/\/\S+)/;

function Bubble({ m, locale }) {
  const parts = localizeLink(m.body).split(linkRe);
  return (
    <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 text-[13px] leading-snug text-[#111B21] shadow-[0_1px_1px_rgba(0,0,0,0.13)]">
      {parts.map((p, i) =>
        linkRe.test(p) ? (
          <span key={i} className="break-all text-[#027EB5] underline">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
      <span className="mt-0.5 block text-right text-[10px] text-[#667781]">
        {new Date(m.created_at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );
}

// A simulated customer phone: shows exactly what a real send would put on their WhatsApp / inbox.
export default function DemoPhone({ itemId, link }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState("whatsapp");
  const { data: messages = [] } = useQuery({
    queryKey: ["udhaar-messages", itemId],
    queryFn: () => api.get(`/receivables/${itemId}/messages`).then((r) => r.data),
    refetchInterval: 2000,
  });
  const wa = messages.filter((m) => m.channel === "whatsapp");
  const mail = messages.filter((m) => m.channel === "email");
  const shown = tab === "whatsapp" ? wa : mail;
  const last = wa.at(-1);
  const business = user?.business?.name || "";

  return (
    <div>
      <div role="tablist" className="mb-4 flex justify-center gap-2">
        {[
          ["whatsapp", t("ph.whatsapp"), MessageCircle],
          ["email", t("ph.email"), Mail],
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm font-bold ${tab === k ? "bg-ink text-white" : "bg-surface-muted text-ink-soft"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="mx-auto w-[290px] overflow-hidden rounded-[2.4rem] border-[9px] border-ink bg-ink shadow-elevated">
        <div className="flex items-center gap-2.5 bg-[#075E54] px-3.5 pb-2.5 pt-4 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-extrabold">{business[0]}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{tab === "whatsapp" ? business : t("ph.email")}</span>
            <span className="block text-[11px] text-white/80">{tab === "whatsapp" ? t("ph.typing") : shown[0]?.to}</span>
          </span>
        </div>
        <div className="h-[330px] space-y-2 overflow-y-auto bg-[#ECE5DD] p-2.5">
          {!shown.length && <p className="pt-24 text-center text-sm text-[#667781]">{t("ph.empty")}</p>}
          {tab === "whatsapp" && shown.map((m, i) => <Bubble key={i} m={m} locale={locale} />)}
          {tab === "email" &&
            shown.map((m, i) => (
              <div key={i} className="rounded-lg bg-white p-3 text-[13px] text-ink shadow-subtle">
                <p className="text-[11px] text-ink-muted">{t("ph.to", { to: m.to })}</p>
                <p className="mt-1 font-extrabold">{m.subject}</p>
                <p className="mt-2 whitespace-pre-line text-ink-soft">{localizeLink(m.body).replace(linkRe, "").trim()}</p>
                <span className="mt-3 inline-block rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-extrabold text-ink">View &amp; pay</span>
              </div>
            ))}
        </div>
      </div>

      {tab === "whatsapp" && last && (
        <p className="mt-3 flex items-center justify-center gap-3 text-xs font-bold text-ink-soft">
          <span className="inline-flex items-center gap-1"><Check size={14} /> {t("ud.sentTo")}</span>
          <span className={`inline-flex items-center gap-1 ${last.delivered ? "" : "opacity-40"}`}><CheckCheck size={14} /> Delivered</span>
          <span className={`inline-flex items-center gap-1 ${last.read ? "text-info" : "opacity-40"}`}><CheckCheck size={14} /> Read</span>
        </p>
      )}

      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="btn-secondary mt-4 w-full">
          <ExternalLink size={16} /> {t("ph.openLink")}
        </a>
      )}
      <p className="mt-3 text-center text-xs text-ink-muted">{t("ph.note")}</p>
    </div>
  );
}
