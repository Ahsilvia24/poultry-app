"use client";

import { useMemo, useState } from "react";
import { FarmHistoryReplica } from "@/components/FarmHistoryReplica";
import { BackHeader, Card } from "@/components/ui";
import { selectFarmHistoryRows } from "@/lib/offline/selectReports";
import type { OfflineSnapshot } from "@/lib/offline/types";

export function FarmHistoryScreen({
  snapshot,
  initialFarmId,
}: {
  snapshot: OfflineSnapshot;
  initialFarmId?: string;
}) {
  const farms = useMemo(
    () =>
      (snapshot.farms ?? [])
        .filter((farm) => !farm.deletedAt)
        .slice()
        .sort((a, b) => a.farmName.localeCompare(b.farmName)),
    [snapshot.farms],
  );
  const [farmId, setFarmId] = useState(() => {
    if (initialFarmId && farms.some((farm) => farm.id === initialFarmId)) return initialFarmId;
    return farms[0]?.id ?? "";
  });
  const rows = useMemo(
    () => (farmId ? selectFarmHistoryRows(snapshot, farmId) : []),
    [snapshot, farmId],
  );

  return (
    <div>
      <BackHeader href="/reports" backLabel="Reports" title="Farm History" />
      {farms.length === 0 ? (
        <Card>
          <p className="text-stone-600">No farms found.</p>
        </Card>
      ) : (
        <>
          <div className="relative mb-6 rounded-2xl border border-emerald-700 bg-white px-4 py-3">
            <select
              id="historyFarm"
              aria-label="Farm"
              value={farmId}
              onChange={(event) => setFarmId(event.target.value)}
              className="w-full appearance-none border-0 bg-transparent py-1 pr-8 text-[17px] font-bold text-stone-900 outline-none"
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.farmName}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-emerald-700">
              ▾
            </span>
          </div>
          <FarmHistoryReplica rows={rows} />
        </>
      )}
    </div>
  );
}
