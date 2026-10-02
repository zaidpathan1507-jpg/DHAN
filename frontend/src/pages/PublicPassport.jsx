import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Printer } from "lucide-react";
import { useParams } from "react-router-dom";

import CreditComponents from "../components/credit/CreditComponents.jsx";
import CreditGauge, { BAND_CHIP } from "../components/credit/CreditGauge.jsx";
import LanguageToggle from "../components/common/LanguageToggle.jsx";
import Logo from "../components/common/Logo.jsx";
import { STATUS_STYLES } from "../components/dashboard/ForecastCard.jsx";
import api from "../lib/apiClient.js";
import { formatINR } from "../lib/constants.js";
import { useI18n } from "../lib/i18n.jsx";

// Lender-facing page: no login, no navigation, nothing but the snapshot the owner chose to share.
export default function PublicPassport() {
  const { token } = useParams();
  const { t, tr, formatDate } = useI18n();
  const query = useQuery({
    queryKey: ["public-passport", token],
    queryFn: () => api.get(`/public/passport/${token}`).then((r) => r.data),
    retry: false,
  });

  const shell = (children) => (
    <div className="min-h-screen bg-surface">
      <header className="no-print border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo size={32} />
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">{children}</main>
    </div>
  );

  if (query.isLoading) return shell(<div className="card h-72 animate-pulse" />);
  if (query.isError) {
    const expired = query.error.response?.status === 410;
    return shell(
      <div className="card px-6 py-14 text-center">
        <h1 className="text-2xl font-extrabold text-ink">{t(expired ? "pub.expired" : "pub.invalid")}</h1>
        <p className="mt-2 text-ink-soft">{query.error.response?.data?.detail}</p>
      </div>
    );
  }

  const p = query.data;
  const c = p.credit;
  const scored = !c.insufficient_history;

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-gold-100 text-gold-700">
          <BadgeCheck size={15} /> {t("pub.verified")}
        </span>
        <span className="text-sm text-ink-muted">{t("pub.preparedFor", { name: p.prepared_for })}</span>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{p.business.name}</h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          {tr("biz", p.business.type)} · {p.business.city} · {t("pub.records", { n: p.months_of_records })}
        </p>
      </div>

      <section className="card flex flex-col items-center gap-6 p-6 sm:flex-row md:p-8">
        {scored ? (
          <>
            <CreditGauge score={c.score} band={c.band} width={230} />
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-ink-muted">{t("pub.score")}</p>
              <span className={`chip mt-1 px-3.5 py-1.5 text-base ${BAND_CHIP[c.band]}`}>{t(`band.${c.band}`)}</span>
              {p.forecast_status && (
                <p className="mt-3 text-[15px] text-ink-soft">
                  {t("pub.outlook")}: <span className={`chip ml-1 ${STATUS_STYLES[p.forecast_status]}`}>{t(`status.${p.forecast_status}`)}</span>
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-[15px] text-ink-soft">{t("pub.notEnough")}</p>
        )}
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("pub.last90")}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            ["common.income", p.last_90_days.income, "text-gain"],
            ["common.expenses", p.last_90_days.expenses, "text-ink"],
            ["common.net", p.last_90_days.net, p.last_90_days.net >= 0 ? "text-gain" : "text-loss"],
            ["pub.avgMonthly", p.last_90_days.avg_monthly_income, "text-ink"],
          ].map(([key, value, tone]) => (
            <div key={key}>
              <dt className="text-sm font-semibold text-ink-muted">{t(key)}</dt>
              <dd className={`num text-xl font-extrabold ${tone}`}>{formatINR(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {scored && (
        <section className="card p-5 md:p-6">
          <h2 className="mb-5 text-lg font-extrabold text-ink">{t("cr.components")}</h2>
          <CreditComponents components={c.components} />
        </section>
      )}

      <footer className="space-y-1 rounded-2xl bg-surface-muted p-4 text-sm text-ink-soft">
        <p>{c.disclaimer || t("pub.basis")}</p>
        <p className="num">
          {t("pub.integrity")}: <span className="font-bold text-ink">{p.integrity_code}</span> · {t("pub.validUntil", { date: formatDate(p.valid_until, { day: "numeric", month: "long", year: "numeric" }) })}
        </p>
      </footer>

      <button onClick={() => window.print()} className="btn-secondary no-print">
        <Printer size={17} /> {t("pub.print")}
      </button>
    </>
  );
}
