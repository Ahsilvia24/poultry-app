import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { initOfflineDb } from "./db";
import { getDb } from "./db/database";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./sessionStore";

type User = { id: string; name: string; email: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SESSION_KEY = "poultrytech_offline_session";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await initOfflineDb();
        const session = await getSessionItem(SESSION_KEY);
        if (!session) {
          setUser(null);
          return;
        }
        const parsed = JSON.parse(session) as User;
        const row = getDb().getFirstSync<{ id: string; name: string; email: string }>(
          "SELECT id, name, email FROM users WHERE id = ?",
          [parsed.id],
        );
        setUser(row ? { id: row.id, name: row.name, email: row.email } : null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await initOfflineDb();
    const row = getDb().getFirstSync<{ id: string; name: string; email: string; password: string }>(
      "SELECT * FROM users WHERE email = ?",
      [email.trim().toLowerCase()],
    );
    if (!row || row.password !== password) {
      // also allow exact email match as seeded
      const row2 = getDb().getFirstSync<{ id: string; name: string; email: string; password: string }>(
        "SELECT * FROM users WHERE email = ?",
        [email.trim()],
      );
      if (!row2 || row2.password !== password) {
        throw new Error("Invalid email or password");
      }
      const next = { id: row2.id, name: row2.name, email: row2.email };
      await setSessionItem(SESSION_KEY, JSON.stringify(next));
      setUser(next);
      return;
    }
    const next = { id: row.id, name: row.name, email: row.email };
    await setSessionItem(SESSION_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const signOut = useCallback(async () => {
    await deleteSessionItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
