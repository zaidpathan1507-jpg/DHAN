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

  const login = async (phone, password) => {
    const { data } = await api.post("/auth/login", { phone, password });
    localStorage.setItem("dhan_token", data.access_token);
    setToken(data.access_token);
    await fetchMe();
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("dhan_token", data.access_token);
    setToken(data.access_token);
    await fetchMe();
  };

  const logout = () => {
    localStorage.removeItem("dhan_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
