import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";

import { formatINR, formatPct } from "../../lib/constants.js";
import { useI18n } from "../../lib/i18n.jsx";
import { useCountUp } from "../../lib/useCountUp.js";

// For expenses a rise is bad, so the delta colour is inverted.
function Stat({ label, icon: Icon, tint, amount, pctChange, invert = false }) {
  const { t } = useI18n();
  const animated = useCountUp(amount);
  const hasChange = pctChange !== null && pctChange !== undefined;
  const good = invert ? pctChange <= 0 : pctChange >= 0;

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 md:flex-col md:items-start md:justify-start md:gap-0 md:px-7 md:py-6">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[15px] font-bold text-ink-soft">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}>
            <Icon size={15} strokeWidth={2.5} />
          </span>
          {label}
        </p>
        {hasChange ? (
          <p className={`mt-1.5 text-sm font-bold md:mt-3 ${good ? "text-gain" : "text-loss"}`}>
            {formatPct(pctChange)} <span className="font-semibold text-ink-muted">{t("common.vsPrev")}</span>
          </p>
        ) : (
          <p className="mt-1.5 text-sm font-semibold text-ink-muted md:mt-3">{t("common.vsPrev")}</p>
        )}
      </div>
      <p className="num shrink-0 text-[22px] font-extrabold leading-none text-ink md:mt-4 md:text-[34px]">
        {amount === undefined ? "—" : formatINR(animated)}
      </p>
    </div>
  );
}

export default function StatStrip({ overview }) {
  const { t } = useI18n();
  const o = overview;
  return (
    <section className="card grid divide-y divide-surface-border md:grid-cols-3 md:divide-x md:divide-y-0">
      <Stat
        label={t("common.income")}
        icon={ArrowUpRight}
        tint="bg-gain-soft text-gain-ink"
        amount={o?.income.amount}
        pctChange={o?.income.pct_change}
      />
      <Stat
        label={t("common.expenses")}
        icon={ArrowDownRight}
        tint="bg-loss-soft text-loss"
        amount={o?.expenses.amount}
        pctChange={o?.expenses.pct_change}
        invert
      />
      <Stat
        label={t("common.net")}
        icon={Scale}
        tint="bg-gold-100 text-gold-700"
        amount={o?.net.amount}
        pctChange={o?.net.pct_change}
      />
    </section>
  );
}
