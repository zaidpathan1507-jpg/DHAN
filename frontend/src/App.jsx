import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout.jsx";
import { useAuth } from "./lib/AuthContext.jsx";
import Credit from "./pages/Credit.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Forecast from "./pages/Forecast.jsx";
import Insights from "./pages/Insights.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Settings from "./pages/Settings.jsx";
import Transactions from "./pages/Transactions.jsx";

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-dhan-green border-t-transparent" />
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
        <Route path="insights" element={<Insights />} />
        <Route path="forecast" element={<Forecast />} />
        <Route path="credit" element={<Credit />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
