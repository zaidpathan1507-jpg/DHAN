import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef } from "react";

import { describeNotification } from "../components/udhaar/udhaarUi.js";
import { useToast } from "../components/common/Toast.jsx";
import api from "./apiClient.js";
import { useAuth } from "./AuthContext.jsx";
import { useI18n } from "./i18n.jsx";

const NotificationsContext = createContext({ items: [], unread: 0, markRead: () => {} });

// Keeps one Server-Sent Events connection open; each new notification toasts and refreshes the Udhaar data live.
export function NotificationsProvider({ children }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const i18n = useI18n();
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;

  const query = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications").then((r) => r.data), enabled: !!token, refetchInterval: 60000 });

  useEffect(() => {
    if (!token) return undefined;
    const source = new EventSource(`/api/v1/notifications/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      const n = JSON.parse(event.data);
      const { t, formatDate } = i18nRef.current;
      showToast(describeNotification(n, { t, formatDate }).title);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (n.type.startsWith("loan_")) {
        queryClient.invalidateQueries({ queryKey: ["loan-apps"] });
        queryClient.invalidateQueries({ queryKey: ["loan-offers"] });
      }
      if (n.type === "payment_auto") ["dashboard-overview", "transactions", "forecast"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    };
    return () => source.close();
  }, [token, queryClient, showToast]);

  const markRead = async () => {
    await api.post("/notifications/read");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <NotificationsContext.Provider value={{ items: query.data?.items ?? [], unread: query.data?.unread ?? 0, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
