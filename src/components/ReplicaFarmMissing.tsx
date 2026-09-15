"use client";

import { useState } from "react";
import { BackCaret } from "@/components/ui";
import { useOffline } from "@/components/OfflineProvider";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { loadOutbox } from "@/lib/offline/idb";
import { replayThenEnsureFarm } from "@/lib/offline/ensureOfflineFarm";
import { resolveAlias } from "@/lib/offline/remapIds";
import { syncPhoneResultMessage } from "@/lib/offline/syncPhoneToWebsite";

export function ReplicaFarmMissing({ farmId }: { farmId: string }) {
  const nav = useOfflineNav();
  const { patchSnapshot, syncNow, syncing } = useOffline();
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
        onClick={() => nav?.navigate("/farms")}
      >
        <BackCaret />
        Farms
      </button>
      <p className="mt-4 text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
      <p className="mt-1 text-sm text-stone-500">
        Sync to pull it from the website, or work this farm offline on this phone.
      </p>
      {status ? (
        <p role="status" className="mt-3 text-sm font-semibold text-stone-700">
          {status}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <button
          type="button"
          disabled={working || syncing}
          onClick={() => {
            void (async () => {
              setWorking(true);
              setStatus(null);
              try {
                const result = await syncNow();
                setStatus(syncPhoneResultMessage(result).text);
                if (result.ok) nav?.navigate(`/farms/${resolveAlias(result.aliases, farmId) || farmId}`);
              } finally {
                setWorking(false);
              }
            })();
          }}
          className="px-3 py-2 text-sm font-bold text-stone-800 underline disabled:opacity-60"
        >
          {working || syncing ? "Syncing…" : "Sync data"}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => {
            void (async () => {
              setWorking(true);
              try {
                const queued = await loadOutbox();
                patchSnapshot((current) => replayThenEnsureFarm(current, queued, farmId));
              } finally {
                setWorking(false);
              }
            })();
          }}
          className="px-3 py-2 text-sm font-bold text-stone-800 underline disabled:opacity-60"
        >
          Work offline
        </button>
      </div>
    </div>
  );
}
