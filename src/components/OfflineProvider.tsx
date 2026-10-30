"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ensureOwnerSnapshot,
  loadIdAliases,
  loadLatestBackup,
  loadLocalSnapshot,
  loadOutbox,
  markLocalFarmWrite,
  persistPhoneStorage,
  saveOutbox,
} from "@/lib/offline/idb";
import { persistOwnerFarms } from "@/lib/offline/persistOwnerFarms";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { pickPersonName } from "@/lib/person-name";
import { unlockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { seedAndMergeFollowUpCompletions } from "@/lib/offline/followUpCompletions";
import { seedAndMergeServiceForms } from "@/lib/offline/serviceForms";
import { uploadLeftoverWrites } from "@/lib/offline/uploadLeftoverWrites";
import { applyFormWrite, coalesceFormWrite } from "@/lib/offline/applyWrites";
import { flushOutbox, reportUnsynced } from "@/lib/offline/flushOutbox";
import { syncPhoneToWebsite, type SyncPhoneResult } from "@/lib/offline/syncPhoneToWebsite";
import type { IdAliases } from "@/lib/offline/remapIds";
import type { OfflineFormWrite, OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";
import { warmOfflineAssets } from "@/lib/offline/warmOfflineAssets";
import { snapshotWithFarmGraph } from "@/lib/offline/emptySnapshot";

type OfflineContextValue = {
  snapshot: OfflineSnapshot | null;
  ready: boolean;
  syncing: boolean;
  pendingCount: number;
  lastBackupAt: string | null;
  aliases: IdAliases;
  enqueue: (item: Omit<OfflineOutboxItem, "id" | "createdAt">) => Promise<void>;
  /** Save a farm on the phone even when the website snapshot is not here yet. */
  commitLocalWrite: (write: OfflineFormWrite) => boolean;
  syncNow: () => Promise<SyncPhoneResult>;
  replaceSnapshot: (snapshot: OfflineSnapshot) => void;
  patchSnapshot: (fn: (snapshot: OfflineSnapshot) => OfflineSnapshot) => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({
  children,
  ownerEmail,
  ownerUserId,
  ownerName,
}: {
  children: ReactNode;
  ownerEmail?: string;
  ownerUserId?: string;
  ownerName?: string;
}) {
  const owner = normalizeOwnerEmail(ownerEmail ?? "");
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [aliases, setAliases] = useState<IdAliases>({});

  const replicaGen = useRef(0);
  const outboxTail = useRef(Promise.resolve());
  const pendingPersist = useRef<OfflineSnapshot | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rememberBackup = useCallback(async (email: string) => {
    const latest = await loadLatestBackup(email);
    setLastBackupAt(latest?.savedAt ?? null);
  }, []);

  const flushPersist = useCallback(() => {
    if (persistTimer.current != null) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    const next = pendingPersist.current;
    pendingPersist.current = null;
    if (!next) return;
    void persistOwnerFarms(next, owner);
  }, [owner]);

  const queuePersist = useCallback(
    (next: OfflineSnapshot) => {
      pendingPersist.current = next;
      if (persistTimer.current != null) clearTimeout(persistTimer.current);
      // Paint the new hours first. IndexedDB clones the whole farm copy on the main thread.
      persistTimer.current = setTimeout(flushPersist, 0);
    },
    [flushPersist],
  );

  const replaceSnapshot = useCallback((next: OfflineSnapshot) => {
    setSnapshot((current) => {
      const merged = seedAndMergeServiceForms(
        seedAndMergeFollowUpCompletions(next, current),
        current,
      );
      queuePersist(merged);
      return merged;
    });
  }, [queuePersist]);

  const patchSnapshot = useCallback((fn: (current: OfflineSnapshot) => OfflineSnapshot) => {
    setSnapshot((current) => {
      if (!current) return current;
      replicaGen.current += 1;
      const next = fn(current);
      queuePersist(next);
      return next;
    });
  }, [queuePersist]);

  const enqueue = useCallback((item: Omit<OfflineOutboxItem, "id" | "createdAt">) => {
    const full: OfflineOutboxItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const run = async () => {
      const items = await loadOutbox();
      const next = coalesceFormWrite(items, full);
      setPendingCount(next.length);
      await saveOutbox(next);
      void reportUnsynced(true);
    };
    const queued = outboxTail.current.then(run, run);
    outboxTail.current = queued.then(
      () => undefined,
      () => undefined,
    );
    void queued.then(() => {
      if (typeof navigator === "undefined" || navigator.onLine === false) return;
      void flushOutbox().then((flushed) => {
        setAliases(flushed.aliases);
        setPendingCount(flushed.pending);
      });
    });
    return queued;
  }, []);

  const commitLocalWrite = useCallback(
    (write: OfflineFormWrite) => {
      markLocalFarmWrite();
      replicaGen.current += 1;
      setSnapshot((current) => {
        const base = snapshotWithFarmGraph(current, {
          userId: ownerUserId || current?.userId || "local-user",
          userEmail: owner || current?.userEmail || "",
          userName: pickPersonName(ownerName, current?.userName),
        });
        const next = applyFormWrite(base, write);
        queuePersist(next);
        return next;
      });
      void enqueue({ kind: "formWrite", payload: write });
      return true;
    },
    [enqueue, owner, ownerName, ownerUserId, queuePersist],
  );

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncPhoneToWebsite();
      setAliases(result.aliases);
      setPendingCount(result.pending);
      return result;
    } catch {
      const leftover = await loadOutbox();
      const stored = await loadIdAliases();
      setPendingCount(leftover.length);
      setAliases(stored);
      return {
        ok: false as const,
        pending: leftover.length,
        aliases: stored,
        reason: "leftover" as const,
      };
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const gen = replicaGen.current;
    if (owner) unlockPhoneOwner(owner);
    (async () => {
      await persistPhoneStorage();
      if (cancelled || replicaGen.current !== gen) return;
      let local = await loadLocalSnapshot(owner);
      if (cancelled || replicaGen.current !== gen) return;
      if (!local && owner && ownerUserId) {
        local = await ensureOwnerSnapshot({
          email: owner,
          userId: ownerUserId,
          userName: pickPersonName(ownerName),
        });
      }
      if (cancelled || replicaGen.current !== gen) return;
      const storedAliases = await loadIdAliases(owner);
      if (!cancelled && replicaGen.current === gen && local) {
        setSnapshot(seedAndMergeFollowUpCompletions(local));
      }
      if (!cancelled) setAliases(storedAliases);
      if (!cancelled && owner) await rememberBackup(owner);
      if (!cancelled) setReady(true);
      if (cancelled) return;
      void warmOfflineAssets();
      const queued = await loadOutbox();
      if (!cancelled) setPendingCount(queued.length);
      await uploadLeftoverWrites(owner);
      if (!cancelled) setPendingCount((await loadOutbox()).length);
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, ownerName, ownerUserId, rememberBackup]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flushPersist();
    }
    window.addEventListener("pagehide", flushPersist);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushPersist);
      document.removeEventListener("visibilitychange", onHide);
      flushPersist();
    };
  }, [flushPersist]);

  useEffect(() => {
    const onOnline = () => {
      void (async () => {
        await uploadLeftoverWrites(owner);
        setPendingCount((await loadOutbox()).length);
      })();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [owner]);

  const value = useMemo(
    () => ({
      snapshot,
      ready,
      syncing,
      pendingCount,
      lastBackupAt,
      aliases,
      enqueue,
      commitLocalWrite,
      syncNow,
      replaceSnapshot,
      patchSnapshot,
    }),
    [
      snapshot,
      ready,
      syncing,
      pendingCount,
      lastBackupAt,
      aliases,
      enqueue,
      commitLocalWrite,
      syncNow,
      replaceSnapshot,
      patchSnapshot,
    ],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

const missingOffline: OfflineContextValue = {
  snapshot: null,
  ready: true,
  syncing: false,
  pendingCount: 0,
  lastBackupAt: null,
  aliases: {},
  enqueue: async () => undefined,
  commitLocalWrite: () => false,
  syncNow: async () => ({
    ok: false,
    pending: 0,
    aliases: {},
    reason: "unreachable",
  }),
  replaceSnapshot: () => undefined,
  patchSnapshot: () => undefined,
};

export function useOffline() {
  return useContext(OfflineContext) ?? missingOffline;
}
