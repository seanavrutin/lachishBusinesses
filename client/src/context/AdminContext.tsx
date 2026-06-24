import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getAdminToken, setAdminToken, verifyAdminToken } from "../lib/api";

interface AdminContextValue {
  isAdmin: boolean;
  /** Verifies the token against the server; stores it and unlocks admin only if valid. */
  signIn: (token: string) => Promise<boolean>;
  signOut: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  // Seeded from localStorage so admin mode survives navigation and reloads.
  const [token, setToken] = useState<string | null>(() => getAdminToken());

  const signIn = useCallback(async (candidate: string): Promise<boolean> => {
    const trimmed = candidate.trim();
    if (!trimmed) return false;
    const ok = await verifyAdminToken(trimmed);
    if (ok) {
      setAdminToken(trimmed);
      setToken(trimmed);
    }
    return ok;
  }, []);

  const signOut = useCallback(() => {
    setAdminToken(null);
    setToken(null);
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({ isAdmin: Boolean(token), signIn, signOut }),
    [token, signIn, signOut],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
