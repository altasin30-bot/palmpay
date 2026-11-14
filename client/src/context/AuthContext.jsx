import { createContext, useContext, useEffect, useState } from "react";
import { api, getStoredUser, setSession, clearSession } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  // On first load, verify the stored JWT is still valid by calling /api/auth/me
  useEffect(() => {
    api.me()
      .then((data) => setUser(data.user))
      .catch(() => { clearSession(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.login({ email, password });
    setSession(data.token, data.user);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    api.logout().catch(()=>{});
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
