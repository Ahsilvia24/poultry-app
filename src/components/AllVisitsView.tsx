"use client";

import { useState } from "react";
import { deleteVisitAction } from "@/app/actions/ops";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { HoldReorderList } from "@/components/HoldReorderList";
import { LoggedVisitTile } from "@/components/LoggedVisitTile";
import { ReplicaLink, useReplicaNavigate } from "@/components/ReplicaLink";
import {
  SettingsValueChip,
  settingsValueTextClass,
} from "@/components/SettingsLayout";
import { BackHeader, Card } from "@/components/ui";
import { formWrite } from "@/lib/offline/formPairs";
import { useHiddenReplicaDeletes } from "@/lib/offline/useHiddenReplicaDeletes";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import type { AllVisitsFarmOption, AllVisitsPageModel, VisitListRow } from "@/lib/offline/selectVisits";
import { loggedAtForFieldLogOrder } from "@/lib/reports/field-log";
import { visitFormHref } from "@/lib/visits/returnTo";
import { ENTER_OTHER_FARM_VALUE, visitPlaceFormHref } from "@/lib/visits/visitPlace";

function AllVisitsAddTile({ farms }: { farms: AllVisitsFarmOption[] }) {
  const navigate = useReplicaNavigate();
  const [farmId, setFarmId] = useState(farms[0]?.id ?? ENTER_OTHER_FARM_VALUE);
  const [placeName, setPlaceName] = useState("");
  const other = farmId === ENTER_OTHER_FARM_VALUE;
  const canLog = other ? placeName.trim().length > 0 : Boolean(farmId);

  return (
    <Card className="mb-5 overflow-visible">
      <div className="flex items-center gap-2">
        <SettingsValueChip className="min-w-0 flex-1">
          <select
            id="all-visits-farm"
            value={farmId}
            onChange={(event) => setFarmId(event.target.value)}
            className={`${settingsValueTextClass} text-left`}
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.farmName}
              </option>
            ))}
            <option value={ENTER_OTHER_FARM_VALUE}>Enter Other</option>
          </select>
        </SettingsValueChip>
        <button
          type="button"
          disabled={!canLog}
          onClick={() =>
            navigate(
              other ? visitPlaceFormHref(placeName) : visitFormHref(farmId, undefined, true),
            )
          }
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Log Visit
        </button>
      </div>
      {other ? (
        <div className="mt-3">
          <input
            id="all-visits-other-place"
            value={placeName}
            onChange={(event) => setPlaceName(event.target.value)}
            placeholder="Feed store or other place"
            className={`${settingsValueTextClass} w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left`}
          />
        </div>
      ) : null}
    </Card>
  );
}

export function AllVisitsView({ model }: { model: AllVisitsPageModel }) {
  const { visible, remove } = useHiddenReplicaDeletes();
  const { enabled, queue } = useReplicaWrite();

  function reorderDay(visits: VisitListRow[], orderedIds: string[]) {
    const items = orderedIds.flatMap((id, index) => {
      const visit = visits.find((row) => row.id === id);
      if (!visit) return [];
      return [
        {
          id: visit.id,
          farmId: visit.farmId,
          loggedAt: loggedAtForFieldLogOrder(visit.visitDate, index),
        },
      ];
    });
    if (!items.length) return;
    if (enabled) {
      queue(formWrite("reorderVisits", { extra: { items } }));
    }
  }

  return (
    <div>
      <BackHeader href="/reports?type=field-log" backLabel="Field Log" title="All Visits" />
      <p className="mb-4 text-sm font-semibold text-stone-500">
        Hold a visit to set Field Log order. Swipe to delete.
      </p>

      <AllVisitsAddTile farms={model.farms} />

      {model.days.length === 0 ? (
        <p className="text-stone-500">No logged visits yet.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="space-y-6">
            {model.days.map((day) => {
              const visits = visible(day.visits);
              if (visits.length === 0) return null;
              return (
                <section key={day.dateKey}>
                  <h2 className="mb-2 text-sm font-extrabold text-stone-700">{day.label}</h2>
                  <HoldReorderList
                    items={visits}
                    onReorder={(orderedIds) => reorderDay(visits, orderedIds)}
                    renderItem={(visit, ctx) => (
                      <LoggedVisitTile
                        visit={visit}
                        fromAllVisits
                        swipeDisabled={ctx.swipeDisabled}
                        suppressOpen={ctx.suppressOpen}
                        onDelete={() =>
                          remove(
                            visit.id,
                            "deleteVisit",
                            { id: visit.id, farmId: visit.farmId },
                            () => deleteVisitAction(visit.farmId, visit.id),
                          )
                        }
                      />
                    )}
                  />
                </section>
              );
            })}
          </div>
        </ExclusiveSwipeGroup>
      )}

      <ReplicaLink
        href="/reports?type=field-log"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-stone-800 underline"
      >
        Back to Field Log
      </ReplicaLink>
    </div>
  );
}
