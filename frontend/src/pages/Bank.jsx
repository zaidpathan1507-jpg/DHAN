import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Building2, Check, Link2, Loader2, RefreshCw, ShieldCheck, Smartphone, Unlink } from "lucide-react";
import { useState } from "react";

import ErrorState from "../components/common/ErrorState.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { useToast } from "../components/common/Toast.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";
import { relativeTime } from "../components/udhaar/udhaarUi.js";
import { useBank, useBankSync } from "../lib/useBankSync.js";
import { useCanEdit } from "../lib/useRole.js";

const STATUS_TONE = { new: "bg-gain-soft text-gain-ink", matched: "bg-gold-100 text-gold-700", duplicate: "bg-surface-muted text-ink-soft", pending: "bg-info-soft text-info" };

function Connect({ banks, canEdit }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pick, setPick] = useState(banks[0].key);
  const link = useMutation({
    mutationFn: () => api.post("/bank/link", { bank: pick }).then((r) => r.data),
    onSuccess: (r) => {
      ["bank", "bank-feed", "transactions", "dashboard-overview", "forecast", "insights", "advisor", "cash-calendar", "gst"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      showToast(t("bk.toastNew", { n: r.sync.new }));
    },
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("bk.pick")}</h2>
        <div role="radiogroup" aria-label={t("bk.pick")} className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {banks.map((b) => (
            <button key={b.key} role="radio" aria-checked={pick === b.key} onClick={() => setPick(b.key)}
              className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors ${pick === b.key ? "border-ink bg-surface" : "border-surface-border bg-surface-card hover:bg-surface"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-gold-500"><Building2 size={19} /></span>
              <span className="text-[15px] font-extrabold leading-snug text-ink">{b.name}</span>
              <span className="num text-xs font-semibold text-ink-muted">{b.ifsc}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-4">
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-ink"><ShieldCheck size={18} className="text-gain" /> {t("bk.consent")}</h3>
          <ul className="mt-3 space-y-2">
            {["bk.scope1", "bk.scope2", "bk.scope3"].map((k) => (
              <li key={k} className="flex items-start gap-2.5 text-sm text-ink-soft"><Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-gain" /> {t(k)}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-bold text-ink">{t("bk.safe")}</p>
        </div>

        {canEdit ? (
          <button onClick={() => link.mutate()} disabled={link.isPending} className="btn-primary mt-5 w-full sm:w-auto">
            {link.isPending ? <><Loader2 size={18} className="animate-spin" /> {t("bk.linking")}</> : <><Link2 size={18} /> {t("bk.allow")}</>}
          </button>
        ) : <p className="mt-5 text-sm font-semibold text-ink-soft">{t("bk.readOnly")}</p>}
        {link.isError && <p role="alert" className="mt-3 rounded-xl bg-loss-soft px-3.5 py-2.5 text-sm font-semibold text-loss">{link.error?.response?.data?.detail || t("common.error")}</p>}
      </section>

      <aside className="rounded-2xl bg-info-soft p-5 text-sm leading-relaxed text-info">
        <p className="font-bold">{t("bk.sandbox")}</p>
      </aside>
    </div>
  );
}

function BankApp({ onPosted }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [kind, setKind] = useState("credit");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI");
  const recv = useQuery({ queryKey: ["receivables"], queryFn: () => api.get("/receivables").then((r) => r.data), staleTime: 30000 });
  const open = (recv.data?.items ?? []).filter((i) => i.kind === (kind === "credit" ? "receivable" : "payable") && !i.paid && !i.claim);
  const post = useMutation({
    mutationFn: (body) => api.post("/bank/simulate", body).then((r) => r.data),
    onSuccess: () => { showToast(t("bk.posted")); onPosted(); },
  });
  const submit = (e) => {
    e.preventDefault();
    post.mutate({ kind, name: name.trim(), amount: Number(amount), mode });
    setAmount("");
  };

  return (
    <section className="card p-5" aria-labelledby="bank-app">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><Smartphone size={18} /></span>
        <div><h2 id="bank-app" className="text-base font-extrabold text-ink">{t("bk.app")}</h2><p className="text-xs text-ink-muted">{t("bk.appSub")}</p></div>
      </div>

      <div role="radiogroup" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
        {[["credit", "bk.in", ArrowDownLeft], ["debit", "bk.out", ArrowUpRight]].map(([k, label, Icon]) => (
          <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg text-sm font-bold ${kind === k ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft"}`}>
            <Icon size={15} /> {t(label)}
          </button>
        ))}
      </div>

      {open.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-ink-muted">{t("bk.quick")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {open.slice(0, 3).map((i) => (
              <button key={i.id} disabled={post.isPending} onClick={() => post.mutate({ kind, name: i.party.split(" – ")[0], amount: i.outstanding, mode: "UPI" })} className="chip min-h-[36px] bg-surface px-3 py-1.5 text-[13px] text-ink hover:bg-surface-muted">
                {t("bk.quickPay", { party: i.party.split(" – ")[0], amount: formatINR(i.outstanding) })}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="bk-name" className="field-label">{kind === "credit" ? t("bk.from") : t("bk.to")}</label>
          <input id="bk-name" required list="bk-names" value={name} onChange={(e) => setName(e.target.value)} className="field" maxLength={80} />
          <datalist id="bk-names">{open.map((i) => <option key={i.id} value={i.party.split(" – ")[0]} />)}</datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="bk-amt" className="field-label">{t("bk.amount")}</label><input id="bk-amt" required type="number" min="1" step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="field num" /></div>
          <div><label htmlFor="bk-mode" className="field-label">{t("bk.via")}</label><select id="bk-mode" value={mode} onChange={(e) => setMode(e.target.value)} className="field">{["UPI", "NEFT", "IMPS", "CARD"].map((m) => <option key={m}>{m}</option>)}</select></div>
        </div>
        <button type="submit" disabled={post.isPending || !name.trim() || !Number(amount)} className="btn-ink w-full">{t("bk.post")}</button>
      </form>
    </section>
  );
}

export default function Bank() {
  const { t, tr, locale, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const bank = useBank();
  const account = bank.data?.account;
  const sync = useBankSync();
  const feed = useQuery({ queryKey: ["bank-feed"], queryFn: () => api.get("/bank/feed", { params: { limit: 40 } }).then((r) => r.data), enabled: !!account, refetchInterval: 10000 });
  const setLive = useMutation({ mutationFn: (live) => api.post("/bank/live", { live }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank"] }) });
  const revoke = useMutation({ mutationFn: () => api.delete("/bank"), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bank"] }); queryClient.removeQueries({ queryKey: ["bank-feed"] }); } });

  if (bank.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (bank.isError) return <div className="card"><ErrorState onRetry={bank.refetch} /></div>;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("bk.title")} subtitle={t("bk.sub")} />

      {!account ? <Connect banks={bank.data.banks} canEdit={canEdit} /> : (
        <>
          <section className="rounded-2xl bg-ink p-5 text-white shadow-hero md:p-6" aria-label={t("bk.connected")}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-gold-500"><Building2 size={22} /></span>
                <div>
                  <p className="text-lg font-extrabold">{account.bank}</p>
                  <p className="num text-sm text-white/70">{account.masked} · {account.ifsc}</p>
                </div>
              </div>
              <span className="chip bg-gain-soft text-gain-ink"><span className="h-2 w-2 rounded-full bg-gain" /> {t("bk.connected")}</span>
            </div>
            <p className="mt-5 text-sm font-semibold text-white/70">{t("bk.balance")}</p>
            <p className="num text-[40px] font-extrabold leading-none md:text-[48px]">{formatINR(account.balance)}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/10 pt-4">
              <p className="text-sm text-white/70">{account.last_sync_at ? t("bk.lastSync", { when: relativeTime(account.last_sync_at, locale) }) : t("bk.never")}</p>
              {canEdit && (
                <>
                  <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn-primary min-h-[40px] px-4 py-2"><RefreshCw size={16} className={sync.isPending ? "animate-spin" : ""} /> {sync.isPending ? t("bk.syncing") : t("bk.syncNow")}</button>
                  <div className="flex items-center gap-3">
                    <button role="switch" aria-checked={account.live} aria-label={t("bk.live")} onClick={() => setLive.mutate(!account.live)} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${account.live ? "bg-gold-500" : "bg-white/25"}`}>
                      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-card transition-all ${account.live ? "left-7" : "left-1"}`} />
                    </button>
                    <span className="text-sm"><span className="font-bold">{t("bk.live")}</span><span className="hidden text-white/60 md:inline"> · {t("bk.liveSub")}</span></span>
                  </div>
                  <button onClick={() => window.confirm(t("bk.revokeConfirm")) && revoke.mutate()} className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold text-white/70 hover:text-white"><Unlink size={15} /> {t("bk.revoke")}</button>
                </>
              )}
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
            <section className="card overflow-hidden" aria-labelledby="bank-feed">
              <div className="border-b border-surface-border px-5 py-4">
                <h2 id="bank-feed" className="text-base font-extrabold text-ink">{t("bk.feed")}</h2>
                <p className="text-sm text-ink-soft">{t("bk.feedSub")}</p>
              </div>
              {!feed.data?.items.length ? <p className="px-5 py-10 text-center text-sm text-ink-soft">{t("bk.feedEmpty")}</p> : (
                <ul className="divide-y divide-surface-border">
                  {feed.data.items.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 px-5 py-3.5">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${l.kind === "credit" ? "bg-gain-soft text-gain-ink" : "bg-loss-soft text-loss"}`}>{l.kind === "credit" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-ink">{l.result?.vendor || l.name}</p>
                        <p className="num truncate text-xs text-ink-muted" title={l.narration}>{l.narration}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`chip px-2 py-0.5 ${STATUS_TONE[l.status]}`}>{t(`bk.st.${l.status}`)}</span>
                          {l.result?.category && <span className="text-xs font-semibold text-ink-soft">{tr("cat", l.result.category)}</span>}
                          {l.result?.party && <span className="text-xs font-semibold text-gold-700">{l.result.party.split(" – ")[0]}{l.result.settled ? " ✓" : ""}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`num text-[15px] font-extrabold ${l.kind === "credit" ? "text-gain" : "text-ink"}`}>{l.kind === "credit" ? "+" : "−"}{formatINR(l.amount)}</p>
                        <p className="text-xs text-ink-muted">{formatDate(l.date, { day: "numeric", month: "short" })}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {canEdit && <BankApp onPosted={() => { queryClient.invalidateQueries({ queryKey: ["bank-feed"] }); }} />}
          </div>
          <p className="rounded-xl bg-info-soft px-4 py-3 text-sm font-semibold text-info">{t("bk.sandbox")}</p>
        </>
      )}
    </div>
  );
}
