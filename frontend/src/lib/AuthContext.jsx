import { createContext, useCallback, useContext, useEffect, useState } from "react";

import api from "./apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("dhan_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem("dhan_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [token, fetchMe]);

  const acceptToken = async (accessToken) => {
    localStorage.setItem("dhan_token", accessToken);
    setToken(accessToken);
    await fetchMe();
  };

  // Resolves to null when signed in, or to { otp_required, phone, demo_code } when a second step is needed.
  const login = async (phone, password) => {
    const { data } = await api.post("/auth/login", { phone, password });
    if (data.otp_required) return data;
    await acceptToken(data.access_token);
    return null;
  };

  const verifyOtp = async (phone, code) => {
    const { data } = await api.post("/auth/otp/verify", { phone, code });
    await acceptToken(data.access_token);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    await acceptToken(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem("dhan_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, verifyOtp, register, logout, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
