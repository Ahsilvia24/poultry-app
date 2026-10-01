"use client";

import { useOffline } from "@/components/OfflineProvider";
import { applyFormWrite } from "@/lib/offline/applyWrites";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { isPhoneOwnedFlockWrite } from "@/lib/offline/phoneOwnedFlockWrite";
import type { OfflineFormWrite } from "@/lib/offline/types";

export function useReplicaWrite() {
  const { snapshot, patchSnapshot, enqueue } = useOffline();
  const enabled = snapshotHasFarmGraph(snapshot);

  function queue(write: OfflineFormWrite) {
    if (!enabled) return false;
    patchSnapshot((current) => applyFormWrite(current, write));
    if (!isPhoneOwnedFlockWrite(write.action)) {
      enqueue({ kind: "formWrite", payload: write });
    }
    return true;
  }

  return { enabled, queue, snapshot };
}
