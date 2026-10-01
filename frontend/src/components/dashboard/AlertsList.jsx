import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import EmptyState from "../common/EmptyState.jsx";
import InsightCard from "../insights/InsightCard.jsx";
import { SkeletonCard } from "../common/Skeleton.jsx";

export default function AlertsList({ data, loading }) {
  if (loading) return <SkeletonCard lines={2} />;

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-navy">Insights &amp; Alerts</h3>
        <Link to="/insights" className="text-xs font-medium text-dhan-green hover:underline">
          View all
        </Link>
      </div>

      {!data?.length ? (
        <EmptyState icon={Sparkles} title="No insights yet." body="DHAN will surface patterns here once you have more activity." />
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
