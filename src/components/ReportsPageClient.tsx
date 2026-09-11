"use client";

import { ReportsView } from "@/components/ReportsView";
import { useOffline } from "@/components/OfflineProvider";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectReports } from "@/lib/offline/selectReports";

export function ReportsPageClient({
  type,
  farmId,
  from,
  to,
}: {
  type?: string;
  farmId?: string;
  from?: string;
  to?: string;
}) {
  const { snapshot, ready } = useOffline();
  if (!snapshotHasFarmGraph(snapshot)) {
    return (
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
          Reports
        </h1>
        <p className="mt-3 text-sm font-semibold text-stone-800">
          {ready ? "Need a connection once to download reports." : "Opening Reports…"}
        </p>
      </div>
    );
  }

  return <ReportsView model={selectReports(snapshot, { type, farmId, from, to })} />;
}
