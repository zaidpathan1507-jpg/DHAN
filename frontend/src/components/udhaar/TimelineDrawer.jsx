import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";

import api from "../../lib/apiClient.js";
import { useI18n } from "../../lib/i18n.jsx";
import Drawer from "../common/Drawer.jsx";
import { describeEvent, EVENT_ICON, EVENT_TONE, relativeTime, STEP_OFFSETS } from "./udhaarUi.js";

export default function TimelineDrawer({ item, onClose }) {
  const { t, tr, locale, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (auto_remind) => api.patch(`/receivables/${item.id}`, { auto_remind }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["receivables"] }),
  });

  if (!item) return null;
  const sentSteps = new Set(item.events.filter((e) => e.type === "auto_reminder").map((e) => e.params.step));
  const due = new Date(item.due_date);

  return (
    <Drawer open={!!item} onClose={onClose} title={item.party}>
      <div className="space-y-7">
        {item.kind === "receivable" && (
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-ink">{t("ud.autoRemind")}</h3>
                <p className="text-sm text-ink-soft">{item.auto_remind ? t("ud.autoRemindOn") : t("ud.autoRemindOff")}</p>
              </div>
              <button
                role="switch"
                aria-checked={item.auto_remind}
                aria-label={t("ud.autoRemind")}
                onClick={() => toggle.mutate(!item.auto_remind)}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${item.auto_remind ? "bg-gold-500" : "bg-surface-strong"}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-card transition-all ${item.auto_remind ? "left-7" : "left-1"}`} />
              </button>
            </div>
            <ol className="mt-4 space-y-2">
              {STEP_OFFSETS.map(([step, offset]) => {
                const date = new Date(due.getTime() + offset * 864e5);
                const done = sentSteps.has(step);
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-gain bg-gain text-white" : "border-surface-strong text-transparent"}`}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="font-bold text-ink">{t(`step.${step}`)}</span>
                    <span className="ml-auto text-ink-muted">{formatDate(date, { day: "numeric", month: "short" })}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-ink-muted">{t("ud.ladderNote")}</p>
          </section>
        )}

        <section>
          <h3 className="mb-3 text-base font-extrabold text-ink">{t("ud.timeline")}</h3>
          {!item.events.length ? (
            <p className="text-sm text-ink-soft">{t("ud.noEvents")}</p>
          ) : (
            <ol className="space-y-4">
              {[...item.events].reverse().map((e, i) => {
                const Icon = EVENT_ICON[e.type] || Check;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${EVENT_TONE[e.type] || "bg-surface-muted"}`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-ink">{describeEvent(e, { t, tr, formatDate })}</span>
                      <span className="block text-xs text-ink-muted" title={new Date(e.at).toLocaleString(locale)}>
                        {relativeTime(e.at, locale)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </Drawer>
  );
}
