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
  persistPhoneStorage,
} from "@/lib/offline/idb";
import { persistOwnerFarms } from "@/lib/offline/persistOwnerFarms";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { unlockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { seedAndMergeFollowUpCompletions } from "@/lib/offline/followUpCompletions";
import { seedAndMergeServiceForms } from "@/lib/offline/serviceForms";
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
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [aliases, setAliases] = useState<IdAliases>({});

  const replicaGen = useRef(0);

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

  const enqueue = useCallback(async (_item: Omit<OfflineOutboxItem, "id" | "createdAt">) => {
    // Phone-only. Writes already land through patchSnapshot.
  }, []);

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
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, ownerName, ownerUserId, rememberBackup]);

  const value = useMemo(
    () => ({
      snapshot,
      ready,
      syncing: false,
      pendingCount: 0,
      lastBackupAt,
      aliases,
      enqueue,
      replaceSnapshot,
      patchSnapshot,
    }),
    [snapshot, ready, lastBackupAt, aliases, enqueue, replaceSnapshot, patchSnapshot],
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
  replaceSnapshot: () => undefined,
  patchSnapshot: () => undefined,
};

export function useOffline() {
  return useContext(OfflineContext) ?? missingOffline;
}
