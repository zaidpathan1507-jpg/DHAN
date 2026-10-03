import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useToast } from "../components/common/Toast.jsx";
import api from "./apiClient.js";
import { useAuth } from "./AuthContext.jsx";
import { formatINR } from "./constants.js";
import { useI18n } from "./i18n.jsx";
import { useCanEdit } from "./useRole.js";

const BOOKS = ["transactions", "dashboard-overview", "forecast", "receivables", "customers", "insights", "advisor", "cash-calendar", "gst"];
const AUTO_SECONDS = 15;

export const useBank = () => useQuery({ queryKey: ["bank"], queryFn: () => api.get("/bank").then((r) => r.data), staleTime: 20000 });

// Pull new statement lines. Anything that changed the books refreshes every screen and says so.
export function useBankSync() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useI18n();
  return useMutation({
    mutationFn: () => api.post("/bank/sync").then((r) => r.data),
    onSuccess: (r) => {
      if (r.imported > 0) {
        BOOKS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        r.matches.forEach((m) => showToast(t("bk.toastMatched", { party: m.party, amount: formatINR(m.amount) })));
        if (r.new > 0 && r.imported > r.matches.length) showToast(t("bk.toastNew", { n: r.new }));
      }
      queryClient.invalidateQueries({ queryKey: ["bank"] });
      queryClient.invalidateQueries({ queryKey: ["bank-feed"] });
    },
  });
}

// Mounted once in the app layout: while a live account is linked, the bank is polled in the background so
// new transactions simply appear, on any screen.
export function useBankAutoSync() {
  const { user } = useAuth();
  const canEdit = useCanEdit();
  const bank = useBank();
  const sync = useBankSync();
  const ref = useRef(sync);
  ref.current = sync;
  const active = !!user && canEdit && !!bank.data?.account?.live;

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      if (!document.hidden && !ref.current.isPending) ref.current.mutate();
    }, AUTO_SECONDS * 1000);
    return () => clearInterval(id);
  }, [active]);
}
