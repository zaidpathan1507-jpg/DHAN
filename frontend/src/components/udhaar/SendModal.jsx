import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { localizeLink } from "../../lib/links.js";
import api from "../../lib/apiClient.js";
import { useI18n } from "../../lib/i18n.jsx";
import Modal from "../common/Modal.jsx";
import { useToast } from "../common/Toast.jsx";
import DemoPhone from "./DemoPhone.jsx";

const STEPS = ["first", "pre", "due", "late3", "late7", "final"];

function suggestedStep(item) {
  if (!item.last_sent_at) return "first";
  const o = item.days_overdue;
  return o >= 15 ? "final" : o >= 7 ? "late7" : o >= 3 ? "late3" : o >= 1 ? "late3" : "due";
}

export default function SendModal({ open, onClose, item, integrations }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState(null); // form state, reset whenever a (new) item opens
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open && item) {
      setResult(null);
      setState({ email: item.email || "", phone: item.phone || "", useEmail: !!item.email, useWa: !!item.phone, step: suggestedStep(item), lang: item.lang || "en" });
    }
  }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useQuery({
    queryKey: ["udhaar-preview", item?.id, state?.step, state?.lang],
    queryFn: () => api.get(`/receivables/${item.id}/preview`, { params: { step: state.step, lang: state.lang } }).then((r) => r.data),
    enabled: open && !!item && !!state,
  });

  const send = useMutation({
    mutationFn: async () => {
      const channels = [state.useEmail && state.email && "email", state.useWa && state.phone && "whatsapp"].filter(Boolean);
      if (!channels.length) throw new Error("no-channel");
      if (state.email !== (item.email || "") || state.phone !== (item.phone || "")) {
        await api.patch(`/receivables/${item.id}`, { email: state.email || undefined, phone: state.phone || undefined });
      }
      return api.post(`/receivables/${item.id}/send`, { channels, step: state.step, lang: state.lang }).then((r) => r.data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["udhaar-messages", item.id] });
      setResult(data);
    },
    onError: (e) => showToast(e.message === "no-channel" ? t("ud.pickChannel") : t("ud.sendFail"), "error"),
  });

  if (!item || !state) return null;
  const set = (k) => (v) => setState((s) => ({ ...s, [k]: v }));

  const channelCard = (key, Icon, label, mode, value, setValue, used, setUsed, placeholder, type) => (
    <div className={`rounded-xl border p-3 ${used && value ? "border-ink bg-surface" : "border-surface-strong"}`}>
      <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={used && !!value} disabled={!value} onChange={(e) => setUsed(e.target.checked)} className="h-5 w-5" />
        <Icon size={18} className="text-ink-soft" />
        <span className="text-[15px] font-extrabold text-ink">{label}</span>
        <span className={`chip ml-auto px-2 py-0.5 ${mode === "live" ? "bg-gain-soft text-gain-ink" : "bg-info-soft text-info"}`}>{mode === "live" ? t("ud.live") : t("ud.simulated")}</span>
      </label>
      <input
        type={type}
        inputMode={type === "tel" ? "numeric" : undefined}
        aria-label={label}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value && !used) setUsed(true);
        }}
        placeholder={placeholder}
        className="field mt-2 min-h-[42px] text-[15px]"
      />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t("ud.sendTitle", { party: item.party })} maxWidth="sm:max-w-xl">
      {result ? (
        <div>
          <ul className="space-y-2">
            {result.results.map((r) => (
              <li key={r.channel} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
                {r.channel === "email" ? <Mail size={18} /> : <MessageCircle size={18} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-ink">{r.channel === "email" ? t("ud.channelEmail") : t("ud.channelWhatsApp")} · {r.to}</span>
                  <span className={`block text-sm ${r.status === "failed" ? "text-loss" : "text-ink-soft"}`}>
                    {r.status === "simulated" ? t("ud.sentSim") : r.status === "sent" ? t("ud.sentTo") : t("ud.sentFail")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <p className="mb-3 text-center text-sm font-bold text-ink-soft">{t("ud.viewPhone")}</p>
            <DemoPhone itemId={item.id} link={localizeLink(result.link)} />
          </div>
          <button onClick={onClose} className="btn-primary mt-5 w-full">{t("ud.done")}</button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {channelCard("email", Mail, t("ud.channelEmail"), integrations?.email, state.email, set("email"), state.useEmail, set("useEmail"), t("ud.addEmail"), "email")}
            {channelCard("wa", MessageCircle, t("ud.channelWhatsApp"), integrations?.whatsapp, state.phone, set("phone"), state.useWa, set("useWa"), t("ud.addPhone"), "tel")}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={state.step === s}
                  onClick={() => set("step")(s)}
                  className={`min-h-[38px] rounded-full border px-3 text-sm font-bold transition-colors ${state.step === s ? "border-ink bg-ink text-white" : "border-surface-strong bg-surface-card text-ink-soft hover:bg-surface-muted"}`}
                >
                  {t(`step.${s}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-ink-soft">{t("ud.language")}</span>
              {["en", "hi"].map((l) => (
                <button key={l} aria-pressed={state.lang === l} onClick={() => set("lang")(l)} className={`min-h-[34px] rounded-full px-3 font-bold ${state.lang === l ? "bg-gold-100 text-gold-700" : "text-ink-muted hover:bg-surface-muted"}`}>
                  {l === "en" ? "English" : "हिन्दी"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="field-label">{t("ud.message")}</p>
            <div className="rounded-xl bg-surface p-4 text-[15px] leading-relaxed text-ink">
              {preview.data ? (
                <>
                  <p className="font-extrabold">{preview.data.subject}</p>
                  <p className="mt-1.5 break-words text-ink-soft">{preview.data.body}</p>
                </>
              ) : (
                <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />
              )}
            </div>
          </div>

          <button onClick={() => send.mutate()} disabled={send.isPending} className="btn-primary w-full">
            {send.isPending ? t("ud.sending") : t("ud.send")}
          </button>
        </div>
      )}
    </Modal>
  );
}
