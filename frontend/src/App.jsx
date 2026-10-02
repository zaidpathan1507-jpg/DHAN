import { Navigate, Route, Routes } from "react-router-dom";

import Ask from "./pages/Ask.jsx";
import Bot from "./pages/Bot.jsx";
import Gst from "./pages/Gst.jsx";
import LenderDesk from "./pages/LenderDesk.jsx";
import Loans from "./pages/Loans.jsx";
import Reports from "./pages/Reports.jsx";
import CashCalendar from "./pages/CashCalendar.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import { useAuth } from "./lib/AuthContext.jsx";
import Credit from "./pages/Credit.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Forecast from "./pages/Forecast.jsx";
import Insights from "./pages/Insights.jsx";
import Login from "./pages/Login.jsx";
import PayPage from "./pages/PayPage.jsx";
import PublicPassport from "./pages/PublicPassport.jsx";
import Receivables from "./pages/Receivables.jsx";
import Register from "./pages/Register.jsx";
import Settings from "./pages/Settings.jsx";
import Transactions from "./pages/Transactions.jsx";

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface" role="status" aria-label="Loading">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gold-500 border-t-transparent" />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/p/:token" element={<PublicPassport />} />
      <Route path="/pay/:token" element={<PayPage />} />
      <Route path="/lender/:token" element={<LenderDesk />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="receivables" element={<Receivables />} />
        <Route path="cash-calendar" element={<CashCalendar />} />
        <Route path="ask" element={<Ask />} />
        <Route path="loans" element={<Loans />} />
        <Route path="bot" element={<Bot />} />
        <Route path="gst" element={<Gst />} />
        <Route path="reports" element={<Reports />} />
        <Route path="insights" element={<Insights />} />
        <Route path="forecast" element={<Forecast />} />
        <Route path="credit" element={<Credit />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
