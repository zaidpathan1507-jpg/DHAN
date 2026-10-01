import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import CreditGauge from "../credit/CreditGauge.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { SkeletonCard } from "../common/Skeleton.jsx";

const BAND_STYLES = {
  EXCELLENT: "bg-dhan-green-light text-dhan-green-dark",
  GOOD: "bg-dhan-green-light text-dhan-green-dark",
  FAIR: "bg-amber-light text-amber",
  "NEEDS WORK": "bg-danger-light text-danger",
};

export default function CreditScoreCard({ data, loading }) {
  if (loading) return <SkeletonCard lines={2} />;

  if (!data || data.insufficient_history) {
    return (
      <div className="card p-5 md:p-6 h-full">
        <h3 className="text-base font-semibold text-navy">Credit Readiness</h3>
        <EmptyState icon={Wallet} title="Not enough history yet." body={data?.message} />
      </div>
    );
  }

  return (
    <div className="card p-5 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-navy">Credit Readiness</h3>
        <Link to="/credit" className="text-xs font-medium text-dhan-green hover:underline">
          View details
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <CreditGauge score={data.score} band={data.band} size={96} />
        <div>
          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${BAND_STYLES[data.band]}`}>
            {data.band}
          </span>
          <p className="mt-2 text-xs text-navy-soft leading-relaxed">
            Biggest opportunity: <span className="font-medium text-navy">{data.biggest_opportunity.label}</span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-navy-soft/50 leading-relaxed">Indicative credit-readiness indicator, not a CIBIL score.</p>
    </div>
  );
}
