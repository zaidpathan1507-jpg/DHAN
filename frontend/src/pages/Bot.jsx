import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCheck, Image as ImageIcon, Mic, Send, Square, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import AiBlock from "../components/ai/AiBlocks.jsx";
import { LogoMark } from "../components/common/Logo.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { useToast } from "../components/common/Toast.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";
import { useVoiceInput } from "../lib/speech.js";

const CHIPS = ["bt.c1", "bt.c2", "bt.c3", "bt.c4", "bt.c5"];

function Bubble({ m, onUndo, onConfirm, busy }) {
  const { t, tr, locale } = useI18n();
  const mine = m.role === "user";
  const time = new Date(m.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const card = m.card;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-[14px] leading-snug text-[#111B21] shadow-[0_1px_1px_rgba(0,0,0,0.13)] ${mine ? "rounded-tr-none bg-[#D9FDD3]" : "rounded-tl-none bg-white"}`}>
        {m.kind === "voice" && <span className="mb-0.5 flex items-center gap-1 text-[11px] font-bold text-[#667781]"><Mic size={12} /> {t("bt.voiceNote")}</span>}
        {m.kind === "image" && <span className="flex items-center gap-1.5 py-1 font-bold"><ImageIcon size={16} /> {t("bt.photoSent")}</span>}
        {m.text && <p className="whitespace-pre-line">{m.text}</p>}

        {card?.kind === "txn" && (
          <div className={`mt-1.5 rounded-md border border-[#E2E8E4] bg-[#F7F9F7] p-2.5 ${card.undone ? "opacity-60" : ""}`}>
            <p className="num text-lg font-extrabold">{card.type === "income" ? "+" : "−"}{formatINR(card.amount)}</p>
            <p className="font-bold">{card.vendor}</p>
            <p className="text-xs text-[#667781]">{tr("cat", card.category)} · {tr("pay", card.payment_mode)} · {new Date(card.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}</p>
            {card.undone ? (
              <p className="mt-1 text-xs font-bold text-loss">{t("bt.undone")}</p>
            ) : (
              <button onClick={() => onUndo()} disabled={busy} className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-xs font-bold text-[#027EB5]"><Undo2 size={13} /> UNDO</button>
            )}
          </div>
        )}

        {card?.kind === "bill" && (
          <div className="mt-1.5 rounded-md border border-[#E2E8E4] bg-[#F7F9F7] p-2.5">
            <p className="text-[11px] font-bold text-[#667781]">{t("bt.billDraft")}</p>
            <p className="num text-lg font-extrabold">{formatINR(card.amount)}</p>
            <p className="font-bold">{card.vendor || "—"}</p>
            <p className="text-xs text-[#667781]">{tr("cat", card.category)}{card.payment_mode ? ` · ${tr("pay", card.payment_mode)}` : ""}{card.gstin ? ` · ${card.gstin}` : ""}</p>
            {card.state === "pending" ? (
              <div className="mt-2 flex gap-2">
                <button onClick={() => onConfirm(card.pending_id, true)} disabled={busy} className="rounded-md bg-[#075E54] px-3 py-1.5 text-xs font-extrabold text-white">{t("bt.save")}</button>
                <button onClick={() => onConfirm(card.pending_id, false)} disabled={busy} className="rounded-md bg-white px-3 py-1.5 text-xs font-extrabold text-[#075E54] ring-1 ring-[#075E54]/30">{t("bt.discard")}</button>
              </div>
            ) : (
              <p className="mt-1 text-xs font-bold text-[#075E54]">{card.state === "saved" ? t("bt.saved") : t("bt.discarded")}</p>
            )}
          </div>
        )}

        {m.blocks?.map((b, i) => <div key={i} className="-mx-1"><AiBlock block={b} /></div>)}
        <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">{time}{mine && <CheckCheck size={13} className="text-[#53BDEB]" />}</span>
      </div>
    </div>
  );
}

export default function Bot() {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef(null);
  const fileRef = useRef(null);
  const key = ["bot-messages"];

  const history = useQuery({ queryKey: key, queryFn: () => api.get("/bot/messages").then((r) => r.data) });
  const messages = history.data ?? [];
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);

  const append = (rows) => queryClient.setQueryData(key, (old = []) => [...old, ...rows]);
  const send = useMutation({
    mutationFn: ({ text: body, file, via }) => {
      const form = new FormData();
      if (body) form.append("text", body);
      if (file) form.append("file", file);
      form.append("lang", lang);
      form.append("via", via || "text");
      return api.post("/bot/message", form).then((r) => r.data);
    },
    onSuccess: (rows) => {
      append(rows);
      ["transactions", "dashboard-overview", "insights"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      queryClient.invalidateQueries({ queryKey: key }); // card state (undone) is server-side
    },
    onError: () => showToast(t("bt.fail"), "error"),
  });
  const confirm = useMutation({
    mutationFn: ({ id, accept }) => api.post("/bot/confirm", { pending_id: id, accept, lang }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const clear = useMutation({ mutationFn: () => api.delete("/bot/messages"), onSuccess: () => queryClient.setQueryData(key, []) });

  const voice = useVoiceInput(lang, (spoken) => send.mutate({ text: spoken, via: "voice" }));

  const submit = (value) => {
    const body = (value ?? text).trim();
    if (!body || send.isPending) return;
    setText("");
    send.mutate({ text: body });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={t("bt.title")} subtitle={t("bt.sub")} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section aria-label={t("bt.title")} className="mx-auto w-full max-w-[26rem] overflow-hidden rounded-[2rem] border-[8px] border-ink bg-ink shadow-elevated">
          <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
            <LogoMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold">{t("bt.name")}</p>
              <p className="text-xs text-white/80">{send.isPending || voice.processing ? "…" : t("bt.online")}</p>
            </div>
            <button onClick={() => clear.mutate()} aria-label={t("bt.clear")} title={t("bt.clear")} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"><Trash2 size={17} /></button>
          </div>

          <div className="h-[28rem] space-y-2 overflow-y-auto bg-[#ECE5DD] p-3 md:h-[32rem]" aria-live="polite">
            {messages.map((m) => (
              <Bubble key={m.id} m={m} busy={send.isPending || confirm.isPending} onUndo={() => send.mutate({ text: "UNDO" })} onConfirm={(id, accept) => confirm.mutate({ id, accept })} />
            ))}
            {(send.isPending || voice.processing) && (
              <div className="flex justify-start"><span className="rounded-lg rounded-tl-none bg-white px-3 py-2 text-[#667781]"><span className="inline-flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#667781]" style={{ animationDelay: `${i * 180}ms` }} />)}</span></span></div>
            )}
            <div ref={bottom} />
          </div>

          <div className="bg-[#F0F2F5] px-2 pb-2 pt-2">
            {voice.listening && <p className="mb-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#075E54]">{t("bt.recording")} {voice.live}</p>}
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-1.5">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send.mutate({ file: f }); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} aria-label={t("bt.photo")} title={t("bt.photo")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5"><Camera size={22} /></button>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("bt.placeholder")} aria-label={t("bt.placeholder")} maxLength={500} className="min-h-[44px] min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-ink outline-none focus:ring-2 focus:ring-[#075E54]/40" />
              {text.trim() || !voice.supported ? (
                <button type="submit" disabled={!text.trim()} aria-label={t("bt.send")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#075E54] text-white disabled:opacity-40"><Send size={19} /></button>
              ) : (
                <button type="button" onClick={voice.listening ? voice.stop : voice.start} aria-label={voice.listening ? t("bt.recording") : t("bt.record")} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#075E54] text-white">
                  {voice.listening && <span className="absolute inset-0 animate-ping rounded-full bg-[#075E54]/50" aria-hidden="true" />}
                  <span className="relative">{voice.listening ? <Square size={16} fill="currentColor" /> : <Mic size={20} />}</span>
                </button>
              )}
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t("ai.try")}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {CHIPS.map((k) => (
                <li key={k}><button onClick={() => submit(t(k))} disabled={send.isPending} className="min-h-[40px] rounded-full border border-surface-strong bg-surface-card px-3.5 text-left text-sm font-bold text-ink-soft hover:border-gold-500 hover:bg-gold-50 hover:text-ink">{t(k)}</button></li>
              ))}
            </ul>
          </div>
          <p className="rounded-2xl bg-info-soft px-4 py-3 text-sm font-semibold text-info">{t("bt.demoNote")}</p>
        </aside>
      </div>
    </div>
  );
}
