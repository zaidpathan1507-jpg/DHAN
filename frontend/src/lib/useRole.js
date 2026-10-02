import { useAuth } from "./AuthContext.jsx";

// Accountants see everything but change nothing. The server enforces it; this hides the buttons that would only 403.
export function useCanEdit() {
  const { user } = useAuth();
  return user?.role !== "accountant";
}
