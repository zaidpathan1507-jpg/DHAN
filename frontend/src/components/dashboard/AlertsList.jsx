import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n.jsx";
import EmptyState from "../common/EmptyState.jsx";
import Skeleton from "../common/Skeleton.jsx";
import InsightCard from "../insights/InsightCard.jsx";

export default function AlertsList({ data, loading }) {
  const { t } = useI18n();

  return (
    <div className="card h-full p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">{t("dash.alerts")}</h2>
        <Link to="/insights" className="link text-sm">
          {t("common.viewAll")}
        </Link>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-48 w-full" />
      ) : !data?.length ? (
        <EmptyState icon={Sparkles} title={t("dash.alertsEmpty")} body={t("dash.alertsEmptyBody")} />
      ) : (
        <div className="mt-4 space-y-3">
          {data.slice(0, 3).map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
