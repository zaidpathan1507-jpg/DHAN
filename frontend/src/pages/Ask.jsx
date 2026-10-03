import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUp, ChevronDown, Copy, Mic, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AiBlock from "../components/ai/AiBlocks.jsx";
import DhanAiMark from "../components/ai/DhanAiMark.jsx";
import api from "../lib/apiClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { canSpeak, speak, stopSpeaking, useVoiceInput } from "../lib/speech.js";

const SUGGESTIONS = ["ai.s1", "ai.s2", "ai.s3", "ai.s4", "ai.s5", "ai.s6"];
const STORE = "dhan_ai_chat";

function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-gold-500" style={{ animationDelay: `${i * 200}ms`, animationDuration: "1.2s" }} />
      ))}
    </span>
  );
}

function Assistant({ m, lang }) {
  const { t } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="flex items-start gap-3">
      <DhanAiMark size={34} className="mt-0.5 shrink-0" />
      <div className="min-w-0 max-w-[calc(100%-3rem)] flex-1">
        {m.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-2xl rounded-tl-md bg-loss-soft px-4 py-3 text-[15px] font-semibold text-loss">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /> {m.content}
          </p>
        ) : (
          <div className="rounded-2xl rounded-tl-md border border-surface-border bg-surface-card px-4 py-3 shadow-subtle">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{m.content}</p>
            {m.blocks?.map((b, i) => <AiBlock key={i} block={b} />)}
            {m.note === "ai_error" && <p className="mt-3 text-xs font-semibold text-warn">{t("ai.fallback")}</p>}

            {m.trace?.length > 0 && (
              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-bold text-ink-muted hover:text-ink">
                  {t("ai.how")} <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {t("ai.looked")}: {[...new Set(m.trace.map((x) => t(`ai.tool.${x.tool}`)))].join(" · ")}
                </p>
              </details>
            )}

            <div className="mt-2 flex gap-1">
              {canSpeak && (
                <button
                  onClick={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : (setSpeaking(true), speak(m.content, m.spoken_lang || lang, () => setSpeaking(false))))}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-ink-muted hover:bg-surface-muted hover:text-ink"
                >
                  {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />} {speaking ? t("ai.stopSpeaking") : t("ai.listen")}
                </button>
              )}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(m.content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-ink-muted hover:bg-surface-muted hover:text-ink"
              >
                <Copy size={14} /> {copied ? t("ai.copied") : t("ai.copy")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Ask() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORE) || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => api.get("/ai/status").then((r) => r.data), staleTime: 60000 });

  useEffect(() => {
    sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30)));
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const ask = useMutation({
    mutationFn: (question) => {
      const history = messages.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, content: m.content }));
      return api.post("/ai/ask", { question, history, lang }).then((r) => r.data);
    },
    onSuccess: (data) => setMessages((ms) => [...ms, { role: "assistant", content: data.answer, blocks: data.blocks, trace: data.trace, mode: data.mode, note: data.note, spoken_lang: data.spoken_lang }]),
    onError: (e) => setMessages((ms) => [...ms, { role: "assistant", error: true, content: t(e.response?.status === 429 ? "ai.rateLimit" : "ai.error") }]),
  });

  const submit = (text) => {
    const q = (text ?? input).trim();
    if (!q || ask.isPending) return;
    setMessages((ms) => [...ms, { role: "user", content: q }]);
    setInput("");
    ask.mutate(q);
  };

  const speech = useVoiceInput(lang, (text) => submit(text));

  // Arriving from "Ask DHAN AI why" links: ask once, then clear the param.
  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setParams({}, { replace: true });
      submit(q);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const live = status.data?.mode === "groq";
  const first = user?.name?.split(" ")[0];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-3xl flex-col md:min-h-[calc(100dvh-5rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <DhanAiMark size={44} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-[28px]">{t("ai.title")}</h1>
            {status.data && (
              <span className={`chip mt-0.5 px-2.5 py-0.5 ${live ? "bg-gold-100 text-gold-700" : "bg-surface-muted text-ink-soft"}`}>{t(live ? "ai.modeGroq" : "ai.modeRules")}</span>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); stopSpeaking(); }} className="btn-secondary min-h-[40px] px-3 py-2">
            <RotateCcw size={15} /> {t("ai.newChat")}
          </button>
        )}
      </header>

      <div className="flex-1 space-y-5 pb-4" aria-live="polite">
        {!messages.length && (
          <div className="pt-4 text-center md:pt-10">
            <DhanAiMark size={64} className="mx-auto" />
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{t("ai.greeting", { name: first })}</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">{t("ai.sub")}</p>
            <p className="mb-3 mt-8 text-sm font-bold text-ink-muted">{t("ai.try")}</p>
            <div className="grid gap-2.5 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((k) => (
                <button key={k} onClick={() => submit(t(k))} className="card min-h-[56px] px-4 py-3 text-left text-[15px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-card">
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-[15px] font-semibold text-white">{m.content}</p>
            </div>
          ) : (
            <Assistant key={i} m={m} lang={lang} />
          )
        )}

        {ask.isPending && (
          <div className="flex items-center gap-3">
            <DhanAiMark size={34} />
            <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-surface-border bg-surface-card px-4 py-3 shadow-subtle">
              <Dots />
              <span className="text-sm font-semibold text-ink-muted">{t("ai.thinking")}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-[84px] z-10 -mx-1 bg-surface px-1 pb-1 pt-2 md:bottom-0">
        {speech.processing && <p className="mb-2 rounded-xl bg-gold-50 px-4 py-2 text-sm font-bold text-gold-700">{t("voice.processing")}</p>}
        {speech.listening && <p className="mb-2 rounded-xl bg-gold-50 px-4 py-2 text-sm font-bold text-gold-700">{t("ai.listening")} {speech.live}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2 rounded-2xl border border-surface-strong bg-surface-card p-2 shadow-card focus-within:border-ink focus-within:ring-2 focus-within:ring-gold-500/50"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={500}
            placeholder={t("ai.placeholder")}
            aria-label={t("ai.placeholder")}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-ink outline-none"
          />
          {speech.supported && (
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? t("ai.stop") : t("ai.mic")}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${speech.listening ? "bg-gold-500 text-ink" : "text-ink-soft hover:bg-surface-muted"}`}
            >
              {speech.listening && <span className="absolute inset-0 animate-ping rounded-xl bg-gold-500/50" aria-hidden="true" />}
              <span className="relative">{speech.listening ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}</span>
            </button>
          )}
          <button type="submit" disabled={!input.trim() || ask.isPending} aria-label={t("ai.send")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-ink transition-colors hover:bg-gold-400 disabled:opacity-40">
            <ArrowUp size={22} strokeWidth={2.75} />
          </button>
        </form>
        {status.data && <p className="mt-2 px-1 text-center text-xs text-ink-muted">{t(live ? "ai.privacyGroq" : "ai.privacyRules")}</p>}
      </div>
    </div>
  );
}
