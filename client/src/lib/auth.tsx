import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuthToken,
  fetchCurrentUser,
  getAuthToken,
  loginRequest,
  setAuthToken,
  type ApiUser,
} from "@/lib/api";

export type AuthUser = {
  userId: string;
  name: string;
  role: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  login: (
    userId: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
};

const STORAGE_KEY = "hiq-class3-auth";

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: ApiUser): AuthUser {
  return {
    userId: user.uid || user.userId,
    name: user.name,
    role: user.roleLabel || (user.isAdmin ? "Admin" : "User"),
    email: user.email,
  };
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.setItem(STORAGE_KEY, raw);
    localStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    if (!getAuthToken()) return null;
    return readStoredUser();
  });

  useEffect(() => {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }

    let cancelled = false;
    fetchCurrentUser()
      .then((result) => {
        if (!cancelled) setUser(toAuthUser(result.user));
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthToken();
          setUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (userId: string, password: string) => {
    const id = userId.trim();
    if (!id) return { ok: false as const, error: "Enter your User ID." };
    if (!password.trim()) return { ok: false as const, error: "Enter your password." };

    try {
      const result = await loginRequest(id, password);
      setAuthToken(result.token);
      setUser(toAuthUser(result.user));
      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      return { ok: false as const, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
