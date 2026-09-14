"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import type { OfflineFormWrite, OfflineFormWriteAction } from "@/lib/offline/types";

export function useHiddenReplicaDeletes() {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [, startHosted] = useTransition();

  const visible = useCallback(
    <T extends { id: string }>(rows: T[]) =>
      hiddenIds.length === 0 ? rows : rows.filter((row) => !hiddenIds.includes(row.id)),
    [hiddenIds],
  );

  function remove(
    id: string,
    action: OfflineFormWriteAction,
    write: Omit<OfflineFormWrite, "action">,
    hosted: () => Promise<unknown>,
  ) {
    setHiddenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    if (enabled) {
      queue(formWrite(action, write));
      return;
    }
    startHosted(async () => {
      await hosted();
      router.refresh();
    });
  }

  return { visible, remove };
}
