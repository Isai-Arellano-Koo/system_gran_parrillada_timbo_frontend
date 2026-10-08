import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/services";
import type { PendingEmailConfirmation, User } from "../types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  login: (
    identifier: string,
    password: string
  ) => Promise<PendingEmailConfirmation | void>;
  confirmEmail: (confirmationToken: string, code: string) => Promise<void>;
  logout: () => void;
  patchSessionUser: (next: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "timbo_auth";

type StoredAuth = {
  token: string;
  user: User;
};

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStored();
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [user, setUser] = useState<User | null>(stored?.user ?? null);

  const storeSession = (accessToken: string, nextUser: User) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: accessToken, user: nextUser })
    );
    setToken(accessToken);
    setUser(nextUser);
  };

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await authApi.login(identifier, password);
    if ("needsEmailConfirmation" in result) {
      return result;
    }
    storeSession(result.accessToken, result.user);
  }, []);

  const confirmEmail = useCallback(async (confirmationToken: string, code: string) => {
    const result = await authApi.confirmEmail(confirmationToken, code);
    storeSession(result.accessToken, result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const patchSessionUser = useCallback((next: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...next };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredAuth;
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...stored, user: updated })
        );
      }
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, login, confirmEmail, logout, patchSessionUser }),
    [user, token, login, confirmEmail, logout, patchSessionUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
