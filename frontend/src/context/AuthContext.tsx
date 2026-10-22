"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setUnauthorizedHandler } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Auth state is global and rarely changes, so Context is enough; page data stays local to each page. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch((err) => {
        // A 401 simply means "not signed in"; anything else still leaves the user signed out.
        if (!(err instanceof ApiError) || err.status !== 401) setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace("/login");
    });
    return () => setUnauthorizedHandler(undefined);
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login({ email, password });
    setUser(user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api.register({ name, email, password });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // Even if the request failed, drop local state; the cookie is httpOnly so the server clears it.
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

/** For the login/register pages: send an already signed-in user to the dashboard. */
export function useRedirectIfSignedIn() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);
}
