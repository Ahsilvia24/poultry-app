"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyCatchImportAction } from "@/app/actions/catch-import";
import { applyPlacementImportAction } from "@/app/actions/placement-import";
import { updateHouseLoggedTempAction } from "@/app/actions/farms";
import { updateSettingsAction } from "@/app/actions/ops";
import {
  loadLocalSnapshot,
  loadOutbox,
  saveLocalSnapshot,
  saveOutbox,
} from "@/lib/offline/idb";
import {
  formDataFromSettingsWrite,
  type HouseTempWrite,
  type SettingsWrite,
} from "@/lib/offline/applyLocal";
import type { CatchSelection } from "@/app/actions/catch-import";
import type { PlacementSelection } from "@/app/actions/placement-import";
import { coalesceFormWrite } from "@/lib/offline/applyWrites";
import { flushFormWrite } from "@/lib/offline/flushWrites";
import type { OfflineFormWrite, OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";

type OfflineContextValue = {
  snapshot: OfflineSnapshot | null;
  ready: boolean;
  syncing: boolean;
  enqueue: (item: Omit<OfflineOutboxItem, "id" | "createdAt">) => void;
  replaceSnapshot: (snapshot: OfflineSnapshot) => void;
  patchSnapshot: (fn: (snapshot: OfflineSnapshot) => OfflineSnapshot) => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

async function reportUnsynced(pending: boolean) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    await fetch("/api/offline/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pending }),
      keepalive: true,
    });
  } catch {
    // Best-effort. Login can still warn when another device is signed in.
  }
}

async function flushOutbox() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const items = await loadOutbox();
  if (items.length === 0) {
    await reportUnsynced(false);
    return;
  }
  const remain: OfflineOutboxItem[] = [];
  for (const item of items) {
    try {
      if (item.kind === "applyPlacement") {
        const payload = item.payload as {
          selections?: PlacementSelection[];
          rows?: unknown;
        };
        const res = await applyPlacementImportAction({
          importId: item.id,
          selections: payload.selections ?? [],
          rows: payload.rows as never,
        });
        if (!res.ok) remain.push(item);
        continue;
      }
      if (item.kind === "applyCatch") {
        const payload = item.payload as {
          selections?: CatchSelection[];
          rows?: unknown;
        };
        const res = await applyCatchImportAction({
          importId: item.id,
          selections: payload.selections ?? [],
          rows: payload.rows as never,
        });
        if (!res.ok) remain.push(item);
        continue;
      }
      if (item.kind === "updateHouseTemp") {
        const payload = item.payload as HouseTempWrite;
        const res = await updateHouseLoggedTempAction(
          payload.farmId,
          payload.houseId,
          payload.temp,
          payload.dateKey,
        );
        if (res?.error) remain.push(item);
        continue;
      }
      if (item.kind === "updateSettings") {
        const res = await updateSettingsAction(
          formDataFromSettingsWrite(item.payload as SettingsWrite),
        );
        if (res && "error" in res && res.error) remain.push(item);
        continue;
      }
      if (item.kind === "formWrite") {
        const ok = await flushFormWrite(item.payload as OfflineFormWrite);
        if (!ok) remain.push(item);
        continue;
      }
      remain.push(item);
    } catch {
      remain.push(item);
    }
  }
  await saveOutbox(remain);
  await reportUnsynced(remain.length > 0);
}

async function pullRemoteSnapshot(): Promise<OfflineSnapshot | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const res = await fetch("/api/offline/snapshot", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { ok?: boolean; snapshot?: OfflineSnapshot };
  return body.ok && body.snapshot ? body.snapshot : null;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const replaceSnapshot = useCallback((next: OfflineSnapshot) => {
    setSnapshot(next);
    void saveLocalSnapshot(next);
  }, []);

  const patchSnapshot = useCallback((fn: (current: OfflineSnapshot) => OfflineSnapshot) => {
    setSnapshot((current) => {
      if (!current) return current;
      const next = fn(current);
      void saveLocalSnapshot(next);
      return next;
    });
  }, []);

  const enqueue = useCallback((item: Omit<OfflineOutboxItem, "id" | "createdAt">) => {
    const full: OfflineOutboxItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    void loadOutbox()
      .then((items) => saveOutbox(coalesceFormWrite(items, full)))
      .then(() => {
        void reportUnsynced(true);
        if (typeof navigator === "undefined" || navigator.onLine === false) return;
        return flushOutbox();
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalSnapshot();
      if (!cancelled && local) setSnapshot(local);
      if (!cancelled) setReady(true);
      if (cancelled) return;
      setSyncing(true);
      try {
        const queued = await loadOutbox();
        if (queued.length) await reportUnsynced(true);
        await flushOutbox();
        const remote = await pullRemoteSnapshot();
        if (!cancelled && remote) replaceSnapshot(remote);
      } catch {
        // Stay on the local replica. Never block the UI on sync.
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    const onOnline = () => {
      setSyncing(true);
      void flushOutbox()
        .then(() => pullRemoteSnapshot())
        .then((remote) => {
          if (remote) replaceSnapshot(remote);
        })
        .catch(() => undefined)
        .finally(() => setSyncing(false));
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [replaceSnapshot]);

  const value = useMemo(
    () => ({ snapshot, ready, syncing, enqueue, replaceSnapshot, patchSnapshot }),
    [snapshot, ready, syncing, enqueue, replaceSnapshot, patchSnapshot],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

const missingOffline: OfflineContextValue = {
  snapshot: null,
  ready: true,
  syncing: false,
  enqueue: () => undefined,
  replaceSnapshot: () => undefined,
  patchSnapshot: () => undefined,
};

export function useOffline() {
  return useContext(OfflineContext) ?? missingOffline;
}
