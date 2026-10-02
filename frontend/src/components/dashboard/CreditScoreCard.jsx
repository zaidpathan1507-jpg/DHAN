import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";
import CreditGauge, { BAND_CHIP } from "../credit/CreditGauge.jsx";

export default function CreditScoreCard({ data, loading }) {
  const { t } = useI18n();

  if (loading) return <Skeleton className="h-72 w-full rounded-2xl" />;

  if (!data || data.insufficient_history) {
    return (
      <div className="card h-full p-5 md:p-6">
        <h2 className="text-lg font-extrabold text-ink">{t("dash.credit")}</h2>
        <EmptyState icon={Wallet} title={t("dash.noHistory")} body={data?.message} />
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">{t("dash.credit")}</h2>
        <Link to="/credit" className="link text-sm">
          {t("common.viewDetails")}
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-center">
        <CreditGauge score={data.score} band={data.band} width={190} />
        <div className="text-center sm:text-left">
          <span className={`chip ${BAND_CHIP[data.band]}`}>{t(`band.${data.band}`)}</span>
          <p className="mt-2.5 text-sm text-ink-soft">
            {t("dash.biggestOpp")}: <span className="font-extrabold text-ink">{data.biggest_opportunity.label}</span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted">{t("dash.notCibil")}</p>
    </div>
  );
}
