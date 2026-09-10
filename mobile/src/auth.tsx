import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { initOfflineDb, isDbReady } from "./db";
import { getDb } from "./db/database";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./lib/sessionStore";

type User = { id: string; name: string; email: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  dbReady: boolean;
  dbError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
};

const SESSION_KEY = "poultrytech_offline_session";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initOfflineDb();
        setDbReady(true);
        setDbError(null);
      } catch (e) {
        setUser(null);
        setDbReady(isDbReady());
        setDbError(e instanceof Error ? e.message : "Could not open local database");
        setLoading(false);
        return;
      }

      try {
        const session = await getSessionItem(SESSION_KEY);
        if (!session) {
          setUser(null);
          return;
        }
        const parsed = JSON.parse(session) as User;
        if (!parsed?.id) {
          setUser(null);
          return;
        }
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

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      if (!user) throw new Error("Sign in to change your password.");
      const row = getDb().getFirstSync<{ password: string }>(
        "SELECT password FROM users WHERE id = ?",
        [user.id],
      );
      if (!row || row.password !== currentPassword) {
        throw new Error("Current password is incorrect.");
      }
      getDb().runSync("UPDATE users SET password = ? WHERE id = ?", [nextPassword, user.id]);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, dbReady, dbError, signIn, signOut, changePassword }),
    [user, loading, dbReady, dbError, signIn, signOut, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
