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
import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import { unlockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { applyPendingOutboxItems } from "@/lib/offline/applyOutbox";
import { coalesceFormWrite } from "@/lib/offline/applyWrites";
import { flushOutbox, pullRemoteSnapshot, reportUnsynced } from "@/lib/offline/flushOutbox";
import { pullWebsiteFarms, type PullWebsiteFarmsResult } from "@/lib/offline/pullWebsiteFarms";
import { canReplaceReplicaWithRemote, type IdAliases } from "@/lib/offline/remapIds";
import { ensureDeviceId } from "@/lib/device-id";
import { seedAndMergeFollowUpCompletions } from "@/lib/offline/followUpCompletions";
import { seedAndMergeServiceForms } from "@/lib/offline/serviceForms";
import { syncPhoneToWebsite, type SyncPhoneResult } from "@/lib/offline/syncPhoneToWebsite";
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
  flushNow: () => Promise<{ pending: number }>;
  syncNow: () => Promise<SyncPhoneResult>;
  pullWebsiteFarmsNow: () => Promise<PullWebsiteFarmsResult>;
  replaceSnapshot: (snapshot: OfflineSnapshot) => void;
  patchSnapshot: (fn: (snapshot: OfflineSnapshot) => OfflineSnapshot) => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

async function bindThisPhone() {
  try {
    await fetch("/api/offline/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: ensureDeviceId() }),
      keepalive: true,
    });
  } catch {
    // Best-effort. The next sign-in can still send the same local device id.
  }
}

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
      const items = await loadOutbox(owner);
      const next = coalesceFormWrite(items, full);
      setPendingCount(next.length);
      await saveOutbox(next, owner);
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
  }, [owner]);

  const flushNow = useCallback(async () => {
    setSyncing(true);
    try {
      const flushed = await flushOutbox();
      setAliases(flushed.aliases);
      setPendingCount(flushed.pending);
      return { pending: flushed.pending };
    } catch {
      const leftover = await loadOutbox();
      setPendingCount(leftover.length);
      return { pending: leftover.length };
    } finally {
      setSyncing(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    const gen = replicaGen.current;
    try {
      const result = await syncPhoneToWebsite();
      setAliases(result.aliases);
      setPendingCount(result.pending);
      if (result.ok && result.snapshot && replicaGen.current === gen) {
        replaceSnapshot(result.snapshot);
      }
      return result;
    } catch {
      const leftover = await loadOutbox();
      const stored = await loadIdAliases();
      setPendingCount(leftover.length);
      setAliases(stored);
      return { ok: false as const, pending: leftover.length, aliases: stored, reason: "leftover" as const };
    } finally {
      setSyncing(false);
    }
  }, [replaceSnapshot]);

  const pullWebsiteFarmsNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await pullWebsiteFarms(owner);
      if (result.ok) replaceSnapshot(result.snapshot);
      return result;
    } catch {
      return { ok: false as const, reason: "unavailable" as const };
    } finally {
      setSyncing(false);
    }
  }, [owner, replaceSnapshot]);

  useEffect(() => {
    let cancelled = false;
    if (owner) unlockPhoneOwner(owner);
    (async () => {
      await persistPhoneStorage();
      const local =
        (await loadLocalSnapshot(owner)) ??
        (owner && ownerUserId
          ? await ensureOwnerSnapshot({
              email: owner,
              userId: ownerUserId,
              userName: ownerName || owner.split("@")[0] || "Tech",
            })
          : null);
      const storedAliases = await loadIdAliases(owner);
      if (!cancelled && local) setSnapshot(seedAndMergeFollowUpCompletions(local));
      if (!cancelled) setAliases(storedAliases);
      if (!cancelled && owner) await rememberBackup(owner);
      if (!cancelled) setReady(true);
      if (cancelled) return;
      void warmOfflineAssets();
      void bindThisPhone();
      // Empty local graph still pulls from Prisma once, so old website farms
      // can land on this phone after the database unlocks.
      if (farmCountInSnapshot(local) > 0) {
        setSyncing(false);
        return;
      }
      setSyncing(true);
      try {
        const queued = await loadOutbox(owner);
        if (!cancelled) setPendingCount(queued.length);
        if (queued.length) await reportUnsynced(true);
        const flushed = await flushOutbox();
        if (!cancelled) setAliases(flushed.aliases);
        if (!cancelled) setPendingCount(flushed.pending);
        if (canReplaceReplicaWithRemote(flushed.pending)) {
          const gen = replicaGen.current;
          const remote = await pullRemoteSnapshot();
          if (cancelled || !remote || replicaGen.current !== gen) return;
          const leftover = await loadOutbox(owner);
          if (!cancelled) setPendingCount(leftover.length);
          replaceSnapshot(
            leftover.length ? applyPendingOutboxItems(remote, leftover) : remote,
          );
        }
      } catch {
        // Stay on the local replica. Never block the UI on sync.
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, ownerName, ownerUserId, rememberBackup, replaceSnapshot]);

  const value = useMemo(
    () => ({
      snapshot,
      ready,
      syncing,
      pendingCount,
      lastBackupAt,
      aliases,
      enqueue,
      flushNow,
      syncNow,
      pullWebsiteFarmsNow,
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
      flushNow,
      syncNow,
      pullWebsiteFarmsNow,
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
  flushNow: async () => ({ pending: 0 }),
  syncNow: async () => ({
    ok: false,
    pending: 0,
    aliases: {},
    reason: "unreachable",
  }),
  pullWebsiteFarmsNow: async () => ({ ok: false, reason: "unavailable" }),
  replaceSnapshot: () => undefined,
  patchSnapshot: () => undefined,
};

export function useOffline() {
  return useContext(OfflineContext) ?? missingOffline;
}
