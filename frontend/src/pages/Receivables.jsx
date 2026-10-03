import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, HandCoins, Hand, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import Modal from "../components/common/Modal.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { SkeletonCard } from "../components/common/Skeleton.jsx";
import { useToast } from "../components/common/Toast.jsx";
import AddEntryModal from "../components/udhaar/AddEntryModal.jsx";
import CustomersTab from "../components/udhaar/CustomersTab.jsx";
import DemoPhone from "../components/udhaar/DemoPhone.jsx";
import PaymentModal from "../components/udhaar/PaymentModal.jsx";
import SendModal from "../components/udhaar/SendModal.jsx";
import TimelineDrawer from "../components/udhaar/TimelineDrawer.jsx";
import UdhaarCard from "../components/udhaar/UdhaarCard.jsx";
import api from "../lib/apiClient.js";
import { formatINR, QUERY_KEYS_TO_REFRESH } from "../lib/constants.js";
import { localizeLink } from "../lib/links.js";
import { useI18n } from "../lib/i18n.jsx";
import { useCanEdit } from "../lib/useRole.js";

const BUCKETS = [
  ["current", "bg-gain"],
  ["d1_30", "bg-gold-500"],
  ["d31_60", "bg-warn"],
  ["d61_plus", "bg-loss"],
];

export default function Receivables() {
  const { t } = useI18n();
  const canEdit = useCanEdit();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("receivable");
  const [addState, setAddState] = useState(null); // { prefill? }
  const [sendId, setSendId] = useState(null);
  const [payId, setPayId] = useState(null);
  const [timelineId, setTimelineId] = useState(null);
  const [phoneId, setPhoneId] = useState(null);
  const focus = params.get("focus");

  const query = useQuery({ queryKey: ["receivables"], queryFn: () => api.get("/receivables").then((r) => r.data), refetchInterval: 20000 });
  const data = query.data;
  const byId = (id) => data?.items.find((i) => i.id === id) ?? null;

  const refresh = () => ["receivables", "customers", "notifications", ...QUERY_KEYS_TO_REFRESH].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const resolveClaim = useMutation({
    mutationFn: ({ item, accept }) => api.post(`/receivables/${item.id}/claim`, { accept }),
    onSuccess: (_, { accept }) => {
      refresh();
      showToast(t(accept ? "ud.claimConfirmed" : "ud.claimRejected"));
    },
  });
  const remove = useMutation({ mutationFn: (item) => api.delete(`/receivables/${item.id}`), onSuccess: refresh });

  // Opening from a notification: jump to the right tab, scroll to the entry and highlight it briefly.
  useEffect(() => {
    if (!focus || !data) return undefined;
    const item = byId(focus);
    if (item && item.kind !== tab) setTab(item.kind);
    const timer = setTimeout(() => document.getElementById(`udhaar-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    const clear = setTimeout(() => setParams({}, { replace: true }), 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [focus, data?.items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (item) => {
    await navigator.clipboard.writeText(localizeLink(item.link));
    showToast(t("ud.linkCopied"));
  };

  if (query.isLoading) return <SkeletonCard lines={6} />;
  if (query.isError) return <div className="card"><ErrorState onRetry={query.refetch} /></div>;

  const money = tab === "customers" ? null : data[tab];
  const shown =
    tab === "customers"
      ? []
      : data.items
          .filter((i) => i.kind === tab && !i.paid)
          .sort((a, b) => (b.claim ? 1 : 0) - (a.claim ? 1 : 0) || new Date(a.due_date) - new Date(b.due_date));
  const totalAging = money ? Object.values(money.aging).reduce((a, b) => a + b, 0) || 1 : 1;
  const simulated = data.integrations.whatsapp === "simulated" || data.integrations.email === "simulated";

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t("rec.title")}
        subtitle={t("rec.sub")}
        action={
          canEdit && (
            <button onClick={() => setAddState({})} className="btn-primary">
              <Plus size={18} strokeWidth={2.5} /> {t("rec.add")}
            </button>
          )
        }
      />

      {data.recovered?.amount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-gain-soft px-5 py-4 text-gain-ink">
          <BadgeCheck size={24} className="shrink-0" />
          <p className="text-[15px] font-extrabold">{t("rv.title")}: <span className="num">{formatINR(data.recovered.amount)}</span> <span className="font-semibold">· {t("rv.body", { amount: formatINR(data.recovered.amount), n: data.recovered.invoices })}</span></p>
        </div>
      )}

      {data.claims_waiting > 0 && (
        <button onClick={() => setTab("receivable")} className="flex w-full items-center gap-3 rounded-2xl bg-gold-500 px-5 py-4 text-left text-ink shadow-card">
          <Hand size={22} className="shrink-0" />
          <span className="text-[15px] font-extrabold">{t(data.claims_waiting === 1 ? "ud.claimsBannerOne" : "ud.claimsBanner", { n: data.claims_waiting })}</span>
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["receivable", t("rec.owedToMe"), "text-gain"],
          ["payable", t("rec.iOwe"), "text-ink"],
        ].map(([k, label, tone]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`card p-5 text-left transition-shadow ${tab === k ? "ring-2 ring-gold-500" : "hover:shadow-card"}`}>
            <p className="text-sm font-bold text-ink-soft">{label}</p>
            <p className={`num mt-1 text-[32px] font-extrabold leading-tight ${tone}`}>{formatINR(data[k].total)}</p>
            <p className={`mt-1 text-sm font-bold ${data[k].overdue ? "text-loss" : "text-ink-muted"}`}>
              {data[k].overdue ? t("rec.overdue", { amount: formatINR(data[k].overdue) }) : t("rec.noneOverdue")}
            </p>
          </button>
        ))}
      </div>

      <div role="tablist" className="flex gap-1 rounded-xl bg-surface-muted p-1">
        {[["receivable", t("rec.tabIn")], ["payable", t("rec.tabOut")], ["customers", t("ud.tabCustomers")]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[42px] flex-1 rounded-lg px-3 text-sm font-extrabold transition-colors ${tab === k ? "bg-surface-card text-ink shadow-subtle" : "text-ink-soft hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "customers" ? (
        <CustomersTab onNewEntry={(c) => setAddState({ prefill: { party: c.party, phone: c.phone || "", email: c.email || "" } })} />
      ) : (
        <>
          {money.total > 0 && (
            <section className="card p-5 md:p-6">
              <h2 className="text-base font-extrabold text-ink">{t("rec.aging")}</h2>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={t("rec.aging")}>
                {BUCKETS.map(([k, color]) => (
                  <div key={k} className={color} style={{ width: `${(money.aging[k] / totalAging) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
                {BUCKETS.map(([k, color]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                    <span className="text-ink-soft">{t(`rec.b.${k}`)}</span>
                    <span className="num ml-auto font-bold text-ink">{formatINR(money.aging[k])}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "receivable" && simulated && (
            <p className="flex items-start gap-2 rounded-xl bg-info-soft px-4 py-3 text-sm font-semibold text-info">
              <Sparkles size={16} className="mt-0.5 shrink-0" /> {t("ud.simBanner")}
            </p>
          )}

          {!shown.length ? (
            <div className="card">
              <EmptyState icon={HandCoins} title={t("rec.empty")} body={t("rec.emptyBody")} />
            </div>
          ) : (
            <ul className="space-y-3">
              {shown.map((item) => (
                <UdhaarCard
                  key={item.id}
                  item={item}
                  readOnly={!canEdit}
                  highlight={focus === item.id}
                  onSend={(i) => setSendId(i.id)}
                  onPay={(i) => setPayId(i.id)}
                  onTimeline={(i) => setTimelineId(i.id)}
                  onPhone={(i) => setPhoneId(i.id)}
                  onConfirm={(i) => resolveClaim.mutate({ item: i, accept: true })}
                  onReject={(i) => resolveClaim.mutate({ item: i, accept: false })}
                  onDelete={(i) => remove.mutate(i)}
                  onCopy={copy}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <AddEntryModal
        open={!!addState}
        onClose={() => setAddState(null)}
        initialKind={tab === "payable" ? "payable" : "receivable"}
        prefill={addState?.prefill}
        onCreated={(item) => setSendId(item.id)}
      />
      <SendModal open={!!sendId} onClose={() => setSendId(null)} item={byId(sendId)} integrations={data.integrations} />
      <PaymentModal open={!!payId} onClose={() => setPayId(null)} item={byId(payId)} />
      <TimelineDrawer item={byId(timelineId)} onClose={() => setTimelineId(null)} />
      <Modal open={!!phoneId} onClose={() => setPhoneId(null)} title={t("ph.title")} maxWidth="sm:max-w-md">
        {phoneId && <DemoPhone itemId={phoneId} link={localizeLink(byId(phoneId)?.link)} />}
      </Modal>
    </div>
  );
}
