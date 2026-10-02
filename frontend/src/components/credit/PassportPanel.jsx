import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircle, QrCode, ShieldCheck, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import api from "../../lib/apiClient.js";
import { useAuth } from "../../lib/AuthContext.jsx";
import { useI18n } from "../../lib/i18n.jsx";
import { useToast } from "../common/Toast.jsx";

const link = (token) => `${window.location.origin}/p/${token}`;

export default function PassportPanel() {
  const { t, formatDate } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(7);
  const [qrFor, setQrFor] = useState(null);

  const list = useQuery({ queryKey: ["passports"], queryFn: () => api.get("/passport").then((r) => r.data) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["passports"] });

  const create = useMutation({
    mutationFn: () => api.post("/passport", { label, valid_days: days }).then((r) => r.data),
    onSuccess: (p) => {
      refresh();
      setLabel("");
      setQrFor(p.id);
      showToast(t("pp.created"));
    },
  });
  const revoke = useMutation({
    mutationFn: (p) => api.delete(`/passport/${p.id}`),
    onSuccess: () => {
      refresh();
      showToast(t("pp.revokedToast"));
    },
  });

  const copy = async (p) => {
    await navigator.clipboard.writeText(link(p.token));
    showToast(t("pp.copied"));
  };
  const whatsapp = (p) =>
    `https://wa.me/?text=${encodeURIComponent(t("pp.msg", { business: user?.business?.name, url: link(p.token) }))}`;

  const status = (p) =>
    p.revoked ? ["pp.revoked", "bg-loss-soft text-loss"] : new Date(p.expires_at) < new Date() ? ["pp.expired", "bg-surface-muted text-ink-soft"] : ["pp.active", "bg-gain-soft text-gain-ink"];

  return (
    <section className="card p-5 md:p-6" aria-labelledby="passport-title">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h2 id="passport-title" className="text-lg font-extrabold text-ink">{t("pp.title")}</h2>
          <p className="mt-0.5 text-[15px] text-ink-soft">{t("pp.sub")}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      >
        <div>
          <label htmlFor="pp-label" className="field-label">{t("pp.for")}</label>
          <input id="pp-label" required maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("pp.forHint")} className="field" />
        </div>
        <div>
          <label htmlFor="pp-days" className="field-label">{t("pp.valid")}</label>
          <select id="pp-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="field">
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>{t("pp.days", { n: d })}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={create.isPending} className="btn-primary">
          {create.isPending ? t("pp.creating") : t("pp.create")}
        </button>
      </form>
      <p className="mt-3 text-sm text-ink-muted">{t("pp.consent")}</p>

      {!!list.data?.length && (
        <div className="mt-6">
          <h3 className="text-base font-extrabold text-ink">{t("pp.links")}</h3>
          <ul className="mt-2 divide-y divide-surface-border">
            {list.data.map((p) => {
              const [statusKey, statusClass] = status(p);
              const live = statusKey === "pp.active";
              return (
                <li key={p.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 basis-44">
                      <p className="truncate text-[15px] font-extrabold text-ink">{p.label}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                        <span className={`chip px-2 py-0.5 ${statusClass}`}>
                          {t(statusKey, { date: formatDate(p.expires_at, { day: "numeric", month: "short" }) })}
                        </span>
                        <span>{t("pp.views", { n: p.views })}</span>
                      </p>
                    </div>
                    {live && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => copy(p)} className="btn-secondary min-h-[40px] px-3 py-2"><Copy size={15} /> {t("pp.copy")}</button>
                        <a href={whatsapp(p)} target="_blank" rel="noreferrer" className="btn-secondary min-h-[40px] px-3 py-2 text-gain-ink"><MessageCircle size={15} /> {t("pp.whatsapp")}</a>
                        <button onClick={() => setQrFor(qrFor === p.id ? null : p.id)} aria-expanded={qrFor === p.id} className="btn-secondary min-h-[40px] px-3 py-2"><QrCode size={15} /> {t("pp.qr")}</button>
                        <button onClick={() => revoke.mutate(p)} aria-label={t("pp.revoke")} title={t("pp.revoke")} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-loss-soft hover:text-loss"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                  {live && qrFor === p.id && (
                    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-surface p-4">
                      <div className="rounded-xl bg-white p-3 shadow-subtle">
                        <QRCodeSVG value={link(p.token)} size={148} level="M" fgColor="#0B1B2B" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{t("pp.scan")}</p>
                        <p className="mt-1 break-all text-xs text-ink-muted">{link(p.token)}</p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
