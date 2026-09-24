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
  persistPhoneStorage,
  saveOutbox,
} from "@/lib/offline/idb";
import { persistOwnerFarms } from "@/lib/offline/persistOwnerFarms";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { unlockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { seedAndMergeFollowUpCompletions } from "@/lib/offline/followUpCompletions";
import { seedAndMergeServiceForms } from "@/lib/offline/serviceForms";
import { seedEmptyPhoneFromWebsite } from "@/lib/offline/seedEmptyPhone";
import { uploadLeftoverWrites } from "@/lib/offline/uploadLeftoverWrites";
import { coalesceFormWrite } from "@/lib/offline/applyWrites";
import { flushOutbox, reportUnsynced } from "@/lib/offline/flushOutbox";
import { syncPhoneToWebsite, type SyncPhoneResult } from "@/lib/offline/syncPhoneToWebsite";
import type { IdAliases } from "@/lib/offline/remapIds";
import type { OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";
import { warmOfflineAssets } from "@/lib/offline/warmOfflineAssets";

type OfflineContextValue = {
  snapshot: OfflineSnapshot | null;
  ready: boolean;
  syncing: boolean;
  pendingCount: number;
  lastBackupAt: string | null;
  aliases: IdAliases;
  enqueue: (item: Omit<OfflineOutboxItem, "id" | "createdAt">) => Promise<void>;
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

  const rememberBackup = useCallback(async (email: string) => {
    const latest = await loadLatestBackup(email);
    setLastBackupAt(latest?.savedAt ?? null);
  }, []);

  const replaceSnapshot = useCallback((next: OfflineSnapshot) => {
    setSnapshot((current) => {
      const merged = seedAndMergeServiceForms(
        seedAndMergeFollowUpCompletions(next, current),
        current,
      );
      void persistOwnerFarms(merged, owner).then(() => {
        if (owner) void rememberBackup(owner);
      });
      return merged;
    });
  }, [owner, rememberBackup]);

  const patchSnapshot = useCallback((fn: (current: OfflineSnapshot) => OfflineSnapshot) => {
    setSnapshot((current) => {
      if (!current) return current;
      replicaGen.current += 1;
      const next = fn(current);
      void persistOwnerFarms(next, owner).then(() => {
        if (owner) void rememberBackup(owner);
      });
      return next;
    });
  }, [owner, rememberBackup]);

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
      if (typeof navigator === "undefined" || navigator.onLine === false) return;
      const flushed = await flushOutbox();
      setAliases(flushed.aliases);
      setPendingCount(flushed.pending);
    };
    const queued = outboxTail.current.then(run, run);
    outboxTail.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

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
    if (owner) unlockPhoneOwner(owner);
    (async () => {
      await persistPhoneStorage();
      let local = await loadLocalSnapshot(owner);
      const seeded = await seedEmptyPhoneFromWebsite(owner);
      if (seeded) local = seeded;
      if (!local && owner && ownerUserId) {
        local = await ensureOwnerSnapshot({
          email: owner,
          userId: ownerUserId,
          userName: ownerName || owner.split("@")[0] || "Tech",
        });
      }
      const storedAliases = await loadIdAliases(owner);
      if (!cancelled && local) setSnapshot(seedAndMergeFollowUpCompletions(local));
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
    const onOnline = () => {
      void (async () => {
        const seeded = await seedEmptyPhoneFromWebsite(owner);
        if (seeded) replaceSnapshot(seeded);
        await uploadLeftoverWrites(owner);
        setPendingCount((await loadOutbox()).length);
      })();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [owner, replaceSnapshot]);

  const value = useMemo(
    () => ({
      snapshot,
      ready,
      syncing,
      pendingCount,
      lastBackupAt,
      aliases,
      enqueue,
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
