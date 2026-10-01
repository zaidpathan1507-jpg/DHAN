import { Users } from "lucide-react";

import { formatINR } from "../../lib/constants.js";
import EmptyState from "../common/EmptyState.jsx";
import { SkeletonCard } from "../common/Skeleton.jsx";

export default function TopVendors({ data, loading }) {
  return (
    <div className="card p-5 md:p-6 h-full">
      <h3 className="text-base font-semibold text-navy">Top Vendors</h3>

      {loading ? (
        <div className="mt-4">
          <SkeletonCard lines={3} />
        </div>
      ) : !data?.length ? (
        <EmptyState icon={Users} title="No vendors yet." body="Your most frequent expense vendors will appear here." />
      ) : (
        <ul className="mt-3 divide-y divide-surface-border">
          {data.slice(0, 6).map((v, i) => (
            <li key={v.vendor} className="flex items-center gap-4 py-3">
              <span className="text-sm font-semibold text-navy-soft/50 w-6 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy truncate">{v.vendor}</p>
                <p className="text-xs text-navy-soft/60">{v.count} transactions</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-navy tabular-nums">{formatINR(v.amount)}</p>
                <p className="text-xs text-navy-soft/60">{v.pct}% of spend</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
