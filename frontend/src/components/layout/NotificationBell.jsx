import { Bell } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useI18n } from "../../lib/i18n.jsx";
import { useNotifications } from "../../lib/notifications.jsx";
import Drawer from "../common/Drawer.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { describeNotification, EVENT_ICON, EVENT_TONE, isLoanNotification, relativeTime } from "../udhaar/udhaarUi.js";

const TYPE_TO_EVENT = { viewed: "viewed", promise: "promise", claim: "claim", note: "note", payment_auto: "payment" };

export default function NotificationBell({ tone = "light" }) {
  const { t, locale, formatDate } = useI18n();
  const { items, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const openPanel = () => {
    setOpen(true);
    if (unread) markRead();
  };

  return (
    <>
      <button
        onClick={openPanel}
        aria-label={`${t("notif.title")}${unread ? ` (${unread})` : ""}`}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${tone === "dark" ? "text-white hover:bg-white/10" : "text-ink-soft hover:bg-surface-muted"}`}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="num absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-loss px-1 text-[11px] font-extrabold text-white ring-2 ring-surface-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title={t("notif.title")}>
        {!items.length ? (
          <EmptyState icon={Bell} title={t("notif.empty")} body={t("notif.emptyBody")} />
        ) : (
          <ul className="-mx-2 space-y-1">
            {items.map((n) => {
              const { title, body } = describeNotification(n, { t, formatDate });
              const evKey = TYPE_TO_EVENT[n.type] || n.type;
              const Icon = EVENT_ICON[evKey] || Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate(isLoanNotification(n.type) ? "/loans" : `/receivables?focus=${n.receivable_id}`);
                    }}
                    className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${EVENT_TONE[evKey] || "bg-surface-muted"}`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-ink">{title}</span>
                      {body && <span className="mt-0.5 block text-sm text-ink-soft">{body}</span>}
                      <span className="mt-0.5 block text-xs text-ink-muted">{relativeTime(n.at, locale)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </>
  );
}
