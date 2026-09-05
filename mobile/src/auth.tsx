import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { initOfflineDb, isDbReady } from "./db";
import { getDb } from "./db/database";
import { deleteSessionItem, getSessionItem, setSessionItem } from "./lib/sessionStore";
import { isCloudUrl } from "./config";
import {
  api,
  clearToken,
  getApiBaseUrl,
  getToken,
  isCloudMode,
  saveToken,
  setApiBaseUrl,
} from "./api";
import { setCloudSyncEnabled, syncNow, syncOnLogin, wipeLocalFarmData } from "./sync";

type User = { id: string; name: string; email: string };

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  dbReady: boolean;
  dbError: string | null;
  cloudMode: boolean;
  apiBaseUrl: string;
  signIn: (email: string, password: string, websiteUrl?: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, websiteUrl?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SESSION_KEY = "poultrytech_offline_session";
const AuthContext = createContext<AuthContextValue | null>(null);

async function rememberWebsite(websiteUrl?: string) {
  const typed = websiteUrl?.trim().replace(/\/$/, "") ?? "";
  if (typed) await setApiBaseUrl(typed);
  return getApiBaseUrl();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [cloudMode, setCloudMode] = useState(false);
  const [apiBaseUrl, setApiBaseUrlState] = useState("");

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
        const base = await getApiBaseUrl();
        setApiBaseUrlState(base);
        const cloud = isCloudUrl(base);
        setCloudMode(cloud);

        if (cloud) {
          const token = await getToken();
          if (!token) {
            setUser(null);
            return;
          }
          const me = await api<{ user: User }>("/api/mobile/me");
          setUser(me.user);
          await setSessionItem(SESSION_KEY, JSON.stringify(me.user));
          setCloudSyncEnabled(true);
          await syncOnLogin();
          return;
        }

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
        await clearToken();
        setCloudSyncEnabled(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || !cloudMode) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncNow().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [user, cloudMode]);

  const signIn = useCallback(async (email: string, password: string, websiteUrl?: string) => {
    await initOfflineDb();
    const base = await rememberWebsite(websiteUrl);
    setApiBaseUrlState(base);
    const cloud = isCloudUrl(base);
    setCloudMode(cloud);

    if (cloud) {
      const result = await api<{ token: string; user: User }>("/api/mobile/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      await saveToken(result.token);
      await setSessionItem(SESSION_KEY, JSON.stringify(result.user));
      setUser(result.user);
      setCloudSyncEnabled(true);
      await syncOnLogin();
      return;
    }

    const row = getDb().getFirstSync<{ id: string; name: string; email: string; password: string }>(
      "SELECT * FROM users WHERE email = ?",
      [email.trim().toLowerCase()],
    );
    if (!row || row.password !== password) {
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

  const signUp = useCallback(
    async (name: string, email: string, password: string, websiteUrl?: string) => {
      await initOfflineDb();
      const base = await rememberWebsite(websiteUrl);
      setApiBaseUrlState(base);
      if (!isCloudUrl(base)) {
        throw new Error("Enter the website address first so the new account is shared with the web app.");
      }
      setCloudMode(true);
      const result = await api<{ token: string; user: User }>("/api/mobile/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      await saveToken(result.token);
      await setSessionItem(SESSION_KEY, JSON.stringify(result.user));
      setUser(result.user);
      setCloudSyncEnabled(true);
      await syncOnLogin();
    },
    [],
  );

  const signOut = useCallback(async () => {
    const cloud = await isCloudMode();
    setCloudSyncEnabled(false);
    await clearToken();
    await deleteSessionItem(SESSION_KEY);
    if (cloud) {
      try {
        wipeLocalFarmData();
      } catch {
        // Local cache clear is best-effort; server farms stay.
      }
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      dbReady,
      dbError,
      cloudMode,
      apiBaseUrl,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading, dbReady, dbError, cloudMode, apiBaseUrl, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
