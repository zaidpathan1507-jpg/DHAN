import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, Globe, LogOut, Mail, QrCode, ScrollText, ShieldCheck, UserRound, Users } from "lucide-react";
import { useState } from "react";

import LanguageToggle from "../components/common/LanguageToggle.jsx";
import PageHeader from "../components/common/PageHeader.jsx";
import { useToast } from "../components/common/Toast.jsx";
import api from "../lib/apiClient.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { QUERY_KEYS_TO_REFRESH } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";
import { useCanEdit } from "../lib/useRole.js";

const CSV_COLUMNS = ["txn_date", "type", "amount", "vendor", "category", "payment_mode", "gstin", "description", "source"];

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function Section({ icon: Icon, title, children, tint = "bg-gold-100 text-gold-700" }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-start gap-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border py-2.5 last:border-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-gold-500" : "bg-surface-strong"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-card transition-all ${checked ? "left-7" : "left-1"}`} />
    </button>
  );
}

function describeAudit(a, t) {
  const key = `aud.${a.action}`;
  const text = t(key, a.detail || {});
  return text === key ? t("aud.unknown") : text;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user, logout, refreshUser } = useAuth();
  const { t, tr, locale } = useI18n();
  const canEdit = useCanEdit();
  const biz = user?.business;
  const [upi, setUpi] = useState(biz?.upi_id || "");
  const [reportEmail, setReportEmail] = useState(user?.report_email || "");
  const [invite, setInvite] = useState({ name: "", phone: "", password: "" });

  const invalidateAll = () => QUERY_KEYS_TO_REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const aiStatus = useQuery({ queryKey: ["ai-status"], queryFn: () => api.get("/ai/status").then((r) => r.data), staleTime: 60000 });
  const integrations = useQuery({ queryKey: ["receivables"], queryFn: () => api.get("/receivables").then((r) => r.data), select: (d) => d.integrations, staleTime: 60000 });
  const team = useQuery({ queryKey: ["team"], queryFn: () => api.get("/team").then((r) => r.data) });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api.get("/audit", { params: { limit: 25 } }).then((r) => r.data) });

  const upiMutation = useMutation({
    mutationFn: () => api.patch("/auth/business", { upi_id: upi.trim() || null }),
    onSuccess: () => { refreshUser(); showToast(t("set.upiSaved")); },
    onError: () => showToast(t("set.upiInvalid"), "error"),
  });
  const seedMutation = useMutation({
    mutationFn: () => api.post("/demo/seed"),
    onSuccess: ({ data }) => { invalidateAll(); showToast(t("set.loaded", { n: data.seeded })); },
    onError: () => showToast(t("set.loadFail"), "error"),
  });
  const resetMutation = useMutation({
    mutationFn: () => api.post("/demo/reset"),
    onSuccess: () => { invalidateAll(); showToast(t("set.resetDone")); },
    onError: () => showToast(t("set.resetFail"), "error"),
  });
  const exportMutation = useMutation({
    mutationFn: () => api.get("/transactions", { params: { limit: 100000 } }).then((r) => r.data.items),
    onSuccess: (items) => {
      const lines = [CSV_COLUMNS.join(","), ...items.map((row) => CSV_COLUMNS.map((c) => csvCell(row[c])).join(","))];
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }); // BOM: Excel reads ₹ and Devanagari correctly
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dhan-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("set.exported", { n: items.length }));
    },
    onError: () => showToast(t("set.exportFail"), "error"),
  });
  const twoFactor = useMutation({
    mutationFn: (on) => api.patch("/auth/security", { two_factor: on }),
    onSuccess: () => { refreshUser(); showToast(t("set.twoFactorSaved")); queryClient.invalidateQueries({ queryKey: ["audit"] }); },
  });
  const weekly = useMutation({
    mutationFn: ({ email, on }) => api.patch("/auth/report-settings", { report_email: email || null, weekly_report: on }),
    onSuccess: () => { refreshUser(); showToast(t("set.weeklySaved")); },
    onError: () => showToast(t("set.weeklyNeedEmail"), "error"),
  });
  const addMember = useMutation({
    mutationFn: () => api.post("/team", invite),
    onSuccess: () => { setInvite({ name: "", phone: "", password: "" }); queryClient.invalidateQueries({ queryKey: ["team"] }); queryClient.invalidateQueries({ queryKey: ["audit"] }); showToast(t("set.teamAdded")); },
    onError: () => showToast(t("set.teamFail"), "error"),
  });
  const removeMember = useMutation({
    mutationFn: (id) => api.delete(`/team/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team"] }); queryClient.invalidateQueries({ queryKey: ["audit"] }); },
  });

  const live = aiStatus.data?.mode === "groq";

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title={t("set.title")} subtitle={t("set.sub")} />

      <Section icon={UserRound} title={t("set.profile")}>
        <dl className="mt-2 text-[15px]">
          <Row label={t("set.owner")} value={user?.name} />
          <Row label={t("set.phone")} value={<span className="num">{user?.phone}</span>} />
          <Row label={t("set.business")} value={biz?.name} />
          <Row label={t("set.type")} value={tr("biz", biz?.business_type)} />
          <Row label={t("set.city")} value={biz?.city} />
        </dl>
      </Section>

      {canEdit && (
        <Section icon={QrCode} title={t("set.collect")}>
          <p className="mt-1 text-[15px] text-ink-soft">{t("set.collectBody")}</p>
          <form onSubmit={(e) => { e.preventDefault(); upiMutation.mutate(); }} className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1"><label htmlFor="upi" className="field-label">{t("set.upi")}</label><input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder={t("set.upiHint")} className="field" autoCapitalize="none" /></div>
            <button type="submit" disabled={upiMutation.isPending} className="btn-primary">{t("set.upiSave")}</button>
          </form>
          {integrations.data && (
            <div className="mt-5 border-t border-surface-border pt-4">
              <h3 className="text-base font-extrabold text-ink">{t("set.integrations")}</h3>
              <ul className="mt-2 space-y-2 text-[15px]">
                {[["email", integrations.data.email], ["whatsapp", integrations.data.whatsapp], ["razorpay", integrations.data.razorpay ? "live" : "off"], ["ai", live ? "live" : "aiRules"]].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink-soft">{t(`set.int.${k}`)}</span>
                    <span className={`chip px-2.5 py-0.5 ${v === "live" ? "bg-gain-soft text-gain-ink" : v === "simulated" || v === "aiRules" ? "bg-info-soft text-info" : "bg-surface-muted text-ink-soft"}`}>{t(`set.int.${v}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-muted">{t("set.int.hint")}</p>
            </div>
          )}
        </Section>
      )}

      <Section icon={Globe} title={t("set.language")}>
        <p className="mt-1 text-[15px] text-ink-soft">{t("set.languageBody")}</p>
        <LanguageToggle className="mt-4" />
      </Section>

      {canEdit && (
        <Section icon={ShieldCheck} title={t("set.security")} tint="bg-gain-soft text-gain-ink">
          <div className="mt-2 flex items-center justify-between gap-4">
            <div><h3 className="text-base font-extrabold text-ink">{t("set.twoFactor")}</h3><p className="text-sm text-ink-soft">{t("set.twoFactorBody")}</p></div>
            <Switch checked={!!user?.two_factor} onChange={(v) => twoFactor.mutate(v)} label={t("set.twoFactor")} />
          </div>
        </Section>
      )}

      {canEdit && (
        <Section icon={Users} title={t("set.team")} tint="bg-info-soft text-info">
          <p className="mt-1 text-[15px] text-ink-soft">{t("set.teamBody")}</p>
          <ul className="mt-3 divide-y divide-surface-border">
            {team.data?.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0"><span className="block truncate text-[15px] font-bold text-ink">{m.name}</span><span className="num text-xs text-ink-muted">{m.phone} · {t(m.role === "owner" ? "set.roleOwner" : "set.roleAccountant")}</span></span>
                {m.role !== "owner" && <button onClick={() => removeMember.mutate(m.id)} className="btn-secondary min-h-[40px] px-3 py-2 text-loss">{t("set.remove")}</button>}
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); addMember.mutate(); }} className="mt-4 rounded-xl bg-surface p-4">
            <h3 className="text-sm font-extrabold text-ink">{t("set.invite")}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input aria-label={t("set.inviteName")} placeholder={t("set.inviteName")} required className="field" value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} />
              <input aria-label={t("set.invitePhone")} placeholder={t("set.invitePhone")} required type="tel" inputMode="numeric" className="field" value={invite.phone} onChange={(e) => setInvite((v) => ({ ...v, phone: e.target.value.replace(/\s/g, "") }))} />
              <input aria-label={t("set.invitePassword")} placeholder={t("set.invitePassword")} required minLength={6} type="text" className="field" value={invite.password} onChange={(e) => setInvite((v) => ({ ...v, password: e.target.value }))} />
            </div>
            <button type="submit" disabled={addMember.isPending} className="btn-ink mt-3">{t("set.inviteAdd")}</button>
          </form>
        </Section>
      )}

      {canEdit && (
        <Section icon={Mail} title={t("set.weekly")} tint="bg-gold-100 text-gold-700">
          <p className="mt-1 text-[15px] text-ink-soft">{t("set.weeklyBody")}</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1"><label htmlFor="rep-email" className="field-label">{t("set.weeklyEmail")}</label><input id="rep-email" type="email" className="field" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} placeholder="you@company.com" /></div>
            <button onClick={() => weekly.mutate({ email: reportEmail, on: !!user?.weekly_report })} className="btn-secondary">{t("set.weeklySave")}</button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3">
            <span className="text-[15px] font-bold text-ink">{t("set.weeklyOn")}</span>
            <Switch checked={!!user?.weekly_report} onChange={(v) => weekly.mutate({ email: reportEmail, on: v })} label={t("set.weeklyOn")} />
          </div>
        </Section>
      )}

      <Section icon={ScrollText} title={t("set.activity")} tint="bg-surface-muted text-ink-soft">
        <p className="mt-1 text-[15px] text-ink-soft">{t("set.activityBody")}</p>
        {!audit.data?.length ? (
          <p className="mt-3 text-sm text-ink-muted">{t("set.activityEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-surface-border">
            {audit.data.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0"><span className="block text-[15px] font-bold text-ink">{describeAudit(a, t)}</span><span className="text-xs text-ink-muted">{a.user}{a.role === "accountant" ? ` · ${t("ro.badge")}` : ""}</span></span>
                <time dateTime={a.at} className="num shrink-0 text-xs text-ink-muted">{new Date(a.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Download} title={t("set.export")} tint="bg-gain-soft text-gain-ink">
        <p className="mt-1 text-[15px] text-ink-soft">{t("set.exportBody")}</p>
        <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="btn-secondary mt-4"><Download size={17} /> {exportMutation.isPending ? t("common.loading") : t("set.exportBtn")}</button>
      </Section>

      {canEdit && (
        <Section icon={Database} title={t("set.demo")} tint="bg-info-soft text-info">
          <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{t("set.demoBody")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="btn-primary">{seedMutation.isPending ? t("set.loading") : t("set.load")}</button>
            <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} className="btn-secondary">{resetMutation.isPending ? t("set.resetting") : t("set.reset")}</button>
          </div>
        </Section>
      )}

      <Section icon={LogOut} title={t("set.session")} tint="bg-loss-soft text-loss">
        <button onClick={logout} className="btn-secondary mt-3 text-loss"><LogOut size={17} /> {t("set.logout")}</button>
      </Section>
    </div>
  );
}
