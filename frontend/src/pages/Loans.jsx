import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Clock, ExternalLink, Landmark, Sparkles, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import Modal from "../components/common/Modal.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { useToast } from "../components/common/Toast.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { emi } from "../lib/finance.js";
import { useI18n } from "../lib/i18n.jsx";
import { useCanEdit } from "../lib/useRole.js";

const STAGES = ["submitted", "reviewing", "approved", "accepted"];

function ApplyModal({ offer, onClose }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(offer.amount);
  const [tenure, setTenure] = useState(offer.default_tenure);
  const monthly = emi(amount, offer.rate, tenure);
  const apply = useMutation({
    mutationFn: () => api.post("/loans/applications", { lender_id: offer.id, amount, tenure }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-apps"] });
      showToast(t("ln.submitted", { lender: offer.name }));
      onClose();
    },
    onError: () => showToast(t("ln.fail"), "error"),
  });

  return (
    <Modal open onClose={onClose} title={t("ln.applyTitle", { lender: offer.name })}>
      <div className="space-y-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="ln-amount" className="text-[15px] font-bold text-ink">{t("ln.amount")}</label>
            <output htmlFor="ln-amount" className="num text-2xl font-extrabold text-ink">{formatINR(amount)}</output>
          </div>
          <input id="ln-amount" type="range" min={50000} max={offer.amount} step={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-2 h-8 w-full cursor-pointer" />
        </div>
        <div>
          <p className="field-label">{t("ln.tenure")}</p>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {offer.tenures.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={tenure === n} onClick={() => setTenure(n)} className={`min-h-[44px] rounded-xl border px-3.5 text-sm font-bold ${tenure === n ? "border-ink bg-ink text-white" : "border-surface-strong text-ink-soft hover:bg-surface-muted"}`}>
                {t("ln.tenureMonths", { n })}
              </button>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-surface p-4 text-sm">
          <div><dt className="text-xs font-semibold text-ink-muted">EMI</dt><dd className="num text-lg font-extrabold text-ink">{formatINR(monthly)}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-muted">{t("ln.rate", { rate: offer.rate })}</dt><dd className="num text-lg font-extrabold text-ink">{offer.rate}%</dd></div>
          <div><dt className="text-xs font-semibold text-ink-muted">{t("ln.fee", { pct: offer.fee_pct })}</dt><dd className="num text-lg font-extrabold text-ink">{formatINR(amount * offer.fee_pct / 100)}</dd></div>
        </dl>
        <p className="num text-sm font-semibold text-ink-soft">{t("ln.total", { amount: formatINR(monthly * tenure) })}</p>
        <p className="rounded-xl bg-gold-50 px-4 py-3 text-sm text-ink-soft">{t("ln.consent", { lender: offer.name })}</p>
        <button onClick={() => apply.mutate()} disabled={apply.isPending} className="btn-primary w-full">{apply.isPending ? t("ln.submitting") : t("ln.submit")}</button>
      </div>
    </Modal>
  );
}

function OfferCard({ offer, canEdit, onApply }) {
  const { t } = useI18n();
  const [tenure, setTenure] = useState(offer.default_tenure);
  return (
    <li className="card flex flex-col p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-extrabold text-ink">{offer.name}</h3>
          <p className="text-sm font-semibold text-ink-muted">{offer.product}</p>
        </div>
        <span className="chip shrink-0 bg-surface-muted px-2.5 py-0.5 text-ink-soft">{t(`ln.type.${offer.type}`)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{offer.tagline}</p>

      <p className="num mt-4 text-[30px] font-extrabold leading-none text-ink">{t("ln.upTo", { amount: formatINR(offer.amount) })}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="chip bg-gain-soft px-2.5 py-0.5 text-gain-ink">{t("ln.rate", { rate: offer.rate })}</span>
        <span className="chip bg-surface-muted px-2.5 py-0.5 text-ink-soft">{t("ln.fee", { pct: offer.fee_pct })}</span>
        <span className="chip bg-gold-100 px-2.5 py-0.5 text-gold-700"><Zap size={12} /> {t("ln.speed", { speed: offer.speed })}</span>
      </div>

      <div className="mt-4" role="radiogroup" aria-label={t("ln.tenure")}>
        <div className="flex flex-wrap gap-1.5">
          {offer.tenures.map((n) => (
            <button key={n} role="radio" aria-checked={tenure === n} onClick={() => setTenure(n)} className={`min-h-[38px] rounded-lg px-3 text-sm font-bold ${tenure === n ? "bg-ink text-white" : "bg-surface-muted text-ink-soft hover:text-ink"}`}>
              {t("ln.tenureMonths", { n })}
            </button>
          ))}
        </div>
        <p className="num mt-2.5 text-[15px] font-extrabold text-ink">{t("ln.emi", { amount: formatINR(emi(offer.amount, offer.rate, tenure)) })}</p>
      </div>

      {canEdit && (
        <button onClick={() => onApply(offer)} className="btn-primary mt-5 w-full">{t("ln.apply")}</button>
      )}
    </li>
  );
}

function Stepper({ status }) {
  const { t } = useI18n();
  const failed = status === "declined" || status === "withdrawn";
  const at = failed ? 1 : Math.max(0, STAGES.indexOf(status));
  return (
    <ol className="flex items-center gap-1.5" aria-label="progress">
      {STAGES.map((s, i) => {
        const done = !failed && i <= at;
        return (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold ${done ? "border-gain bg-gain text-white" : failed && i === 0 ? "border-gain bg-gain text-white" : "border-surface-strong text-ink-muted"}`}>
              {done || (failed && i === 0) ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`hidden text-xs font-bold sm:block ${done ? "text-ink" : "text-ink-muted"}`}>{t(`ln.stage.${s}`)}</span>
            {i < STAGES.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${done && i < at ? "bg-gain" : "bg-surface-strong"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function ApplicationCard({ app, canEdit }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["loan-apps"] });
  const accept = useMutation({ mutationFn: () => api.post(`/loans/applications/${app.id}/accept`), onSuccess: () => { refresh(); showToast(t("ln.accepted")); } });
  const withdraw = useMutation({ mutationFn: () => api.post(`/loans/applications/${app.id}/withdraw`), onSuccess: refresh });
  const final = app.decision?.amount ? app.decision : null;
  const open = ["submitted", "reviewing", "approved"].includes(app.status);

  return (
    <li className="card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold text-ink">{app.lender_name}</h3>
          <p className="text-sm text-ink-muted">{app.product} · {t("ln.terms", { amount: formatINR(app.amount), rate: app.rate, n: app.tenure })}</p>
        </div>
        <span className={`chip px-3 py-1 text-sm ${app.status === "approved" ? "bg-gain-soft text-gain-ink" : app.status === "accepted" ? "bg-gain text-white" : app.status === "declined" || app.status === "withdrawn" ? "bg-loss-soft text-loss" : "bg-gold-100 text-gold-700"}`}>
          {["submitted", "reviewing"].includes(app.status) && <Clock size={13} />} {t(`ln.stage.${app.status}`)}
        </span>
      </div>

      <div className="mt-4"><Stepper status={app.status} /></div>

      {final && (
        <p className="num mt-4 rounded-xl bg-gain-soft px-4 py-3 text-[15px] font-bold text-gain-ink">
          {t("ln.terms", { amount: formatINR(final.amount), rate: final.rate, n: final.tenure })} · {t("ln.emi", { amount: formatINR(emi(final.amount, final.rate, final.tenure)) })}
        </p>
      )}
      {app.status === "declined" && <p className="mt-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-semibold text-loss">{t("ln.declinedReason", { reason: app.decision?.reason })}</p>}
      {app.status === "accepted" && <p className="mt-4 rounded-xl bg-gain-soft px-4 py-3 text-sm font-semibold text-gain-ink">{t("ln.accepted")}</p>}
      {["submitted", "reviewing"].includes(app.status) && <p className="mt-4 text-sm text-ink-muted">{t("ln.waiting")}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canEdit && app.status === "approved" && <button onClick={() => accept.mutate()} disabled={accept.isPending} className="btn-primary"><BadgeCheck size={17} /> {t("ln.accept")}</button>}
        {canEdit && open && <button onClick={() => withdraw.mutate()} className="btn-secondary">{t("ln.withdraw")}</button>}
        <a href={`/lender/${app.passport_token}`} target="_blank" rel="noreferrer" className="link ml-auto inline-flex items-center gap-1.5 text-sm"><ExternalLink size={14} /> {t("ln.openDesk")}</a>
      </div>
    </li>
  );
}

export default function Loans() {
  const { t } = useI18n();
  const canEdit = useCanEdit();
  const [applying, setApplying] = useState(null);
  const offers = useQuery({ queryKey: ["loan-offers"], queryFn: () => api.get("/loans/offers").then((r) => r.data) });
  const apps = useQuery({
    queryKey: ["loan-apps"],
    queryFn: () => api.get("/loans/applications").then((r) => r.data),
    refetchInterval: (q) => (q.state.data?.some((a) => ["submitted", "reviewing"].includes(a.status)) ? 3000 : 20000),
  });

  if (offers.isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (offers.isError) return <div className="card"><ErrorState onRetry={offers.refetch} /></div>;
  const d = offers.data;
  const p = d.profile;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("ln.title")} subtitle={t("ln.sub")} />

      <p className="flex items-start gap-2 rounded-xl bg-info-soft px-4 py-3 text-sm font-semibold text-info">
        <Sparkles size={16} className="mt-0.5 shrink-0" /> {t("ln.simBanner")}
      </p>

      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-hero md:p-8" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 39px, rgba(255,255,255,0.04) 39px 40px)" }}>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[15px] font-semibold text-white/80">{d.max_amount ? t("ln.eligibleLabel") : t("ln.noOffers")}</p>
            <p className="num mt-1 text-[44px] font-extrabold leading-none tracking-tight md:text-[56px]">{d.max_amount ? formatINR(d.max_amount) : "—"}</p>
          </div>
          <dl className="grid grid-cols-3 gap-5 text-sm">
            <div><dt className="font-semibold text-white/75">{t("ln.score")}</dt><dd className="num text-xl font-extrabold">{p.score ?? "—"}</dd></div>
            <div><dt className="font-semibold text-white/75">{t("ln.months")}</dt><dd className="num text-xl font-extrabold">{p.months}</dd></div>
            <div><dt className="font-semibold text-white/75">{t("ln.income")}</dt><dd className="num text-xl font-extrabold">{formatINR(p.avg_income)}</dd></div>
          </dl>
        </div>
      </section>

      {!!apps.data?.length && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">{t("ln.apps")}</h2>
          <ul className="space-y-3">{apps.data.map((a) => <ApplicationCard key={a.id} app={a} canEdit={canEdit} />)}</ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">{t("ln.offers")}</h2>
        {!d.offers.length ? (
          <div className="card"><EmptyState icon={Landmark} title={t("ln.noOffers")} body={t("ln.noOffersBody")} /></div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">{d.offers.map((o) => <OfferCard key={o.id} offer={o} canEdit={canEdit} onApply={setApplying} />)}</ul>
        )}
      </section>

      {!!d.ineligible.length && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">{t("ln.notEligible")}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {d.ineligible.map((l) => (
              <li key={l.id} className="rounded-2xl border border-surface-border bg-surface-card p-4">
                <p className="text-[15px] font-extrabold text-ink">{l.name} <span className="font-semibold text-ink-muted">· {l.product}</span></p>
                <ul className="mt-2 space-y-1">
                  {l.reasons.map((r) => (
                    <li key={r.key} className="flex items-start gap-2 text-sm text-ink-soft"><XCircle size={15} className="mt-0.5 shrink-0 text-loss" />
                      {t(`ln.need.${r.key}`, { need: ["income", "receivables"].includes(r.key) ? formatINR(r.need) : r.need, have: ["income", "receivables"].includes(r.key) ? formatINR(r.have || 0) : (r.have ?? "—") })}
                    </li>
                  ))}
                </ul>
                <Link to="/credit" className="link mt-2 inline-block text-sm">{t("ln.improve")}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {applying && <ApplyModal offer={applying} onClose={() => setApplying(null)} />}
    </div>
  );
}
