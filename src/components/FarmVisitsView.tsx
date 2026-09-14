"use client";

import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { LoggedVisitTile } from "@/components/LoggedVisitTile";
import { ReplicaLink } from "@/components/ReplicaLink";
import { BackHeader } from "@/components/ui";
import type { VisitsPageModel } from "@/lib/offline/selectVisits";

export function FarmVisitsView({ model }: { model: VisitsPageModel }) {
  return (
    <div>
      <BackHeader href={`/farms/${model.farmId}`} backLabel="Farm" title="Logged Visits" />

      <ReplicaLink
        href={`/farms/${model.farmId}/visits/new`}
        className="mb-4 flex min-h-11 items-center justify-center rounded-[10px] bg-emerald-700 px-3 py-2.5 text-center text-[15px] font-bold text-white hover:bg-emerald-800"
      >
        Log Visit
      </ReplicaLink>

      {model.visits.length === 0 ? (
        <p className="text-stone-500">No logged visits yet.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="space-y-2.5">
            {model.visits.map((visit) => (
              <LoggedVisitTile key={visit.id} farmId={model.farmId} visit={visit} />
            ))}
          </div>
        </ExclusiveSwipeGroup>
      )}
    </div>
  );
}
