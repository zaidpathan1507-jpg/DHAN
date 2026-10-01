import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database } from "lucide-react";

import api from "../lib/apiClient.js";
import { useToast } from "../components/common/Toast.jsx";

const ALL_KEYS = [
  "dashboard-overview",
  "dashboard-cashflow",
  "dashboard-spending-mix",
  "dashboard-top-vendors",
  "transactions",
  "insights",
  "forecast",
  "credit-readiness",
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidateAll = () => ALL_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const seedMutation = useMutation({
    mutationFn: () => api.post("/demo/seed"),
    onSuccess: ({ data }) => {
      invalidateAll();
      showToast(`Loaded ${data.seeded} demo transactions`);
    },
    onError: () => showToast("Couldn't load demo data.", "error"),
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post("/demo/reset"),
    onSuccess: () => {
      invalidateAll();
      showToast("Demo data reset");
    },
    onError: () => showToast("Couldn't reset demo data.", "error"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-navy-soft mt-1">Manage demo data for this business.</p>
      </div>

      <div className="card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-light text-info">
            <Database size={17} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-navy">Demo Data</h3>
            <p className="text-sm text-navy-soft mt-1">
              Load ~180 days of realistic seeded transaction history (tagged DEMO DATA) so Dashboard, Insights,
              Forecast and Credit Readiness have enough data to demonstrate. Resetting removes only demo data — your
              own LIVE transactions are never affected.
            </p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="btn-primary">
                {seedMutation.isPending ? "Loading..." : "Load Demo Data"}
              </button>
              <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} className="btn-secondary">
                {resetMutation.isPending ? "Resetting..." : "Reset Demo"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
