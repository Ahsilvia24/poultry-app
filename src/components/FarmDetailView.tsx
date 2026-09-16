"use client";

import { useLayoutEffect, useState } from "react";
import { ReplicaLink } from "@/components/ReplicaLink";
import { resetAppScroll } from "@/lib/app-scroll";
import { createFlockAction } from "@/app/actions/farms";
import { FarmHouseFocus } from "@/components/FarmHouseFocus";
import { HouseCard } from "@/components/HouseCard";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { AddFlockSection } from "@/components/AddFlockSection";
import { AddHouseForm } from "@/components/AddHouseForm";
import { FarmInfoEditor } from "@/components/FarmInfoEditor";
import { FarmQuickLinks } from "@/components/FarmQuickLinks";
import { BackCaret, Card } from "@/components/ui";
import { appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import type { FarmDetailModel } from "@/lib/offline/selectFarmDetail";

export function FarmDetailView({
  model,
  timeZone,
  focusHouseFlockId,
}: {
  model: FarmDetailModel;
  timeZone?: string;
  focusHouseFlockId?: string | null;
}) {
  const farm = model.farm;
  const [addFlockOpen, setAddFlockOpen] = useState(false);
  const houseById = new Map(model.houses.map((house) => [house.id, house]));
  const focusHouseId = focusHouseFlockId
    ? model.houseCards.find((card) => card.houseFlockId === focusHouseFlockId)?.houseId
    : null;

  useLayoutEffect(() => {
    if (focusHouseId) return;
    resetAppScroll();
  }, [model.farm.id, focusHouseId]);

  async function submitFlock(formData: FormData) {
    return createFlockAction(farm.id, formData);
  }

  return (
    <div>
      <FarmHouseFocus houseId={focusHouseId} />
      <div className="mb-6 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
        <ReplicaLink
          href="/farms"
          className="inline-flex min-h-11 items-center gap-1 justify-self-start rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          <BackCaret />
          Farms
        </ReplicaLink>
        <FarmInfoEditor farm={farm} />
      </div>

      <div className="mb-6">
        <FarmQuickLinks
          farmId={farm.id}
          completeFlocks={model.activeFlocks}
          onAddFlock={() => setAddFlockOpen(true)}
        />
      </div>

      <ExclusiveSwipeGroup>
        <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
          {model.houseCards.map((card) => {
            const house = houseById.get(card.houseId);
            if (!house) return null;
            return (
              <div key={house.id} id={`house-${house.id}`}>
                <HouseCard
                  farmId={farm.id}
                  house={house}
                  hasFlock={card.hasFlock}
                  status={card.status}
                  birdsPlaced={card.birdsPlaced}
                  metrics={card.metrics}
                  projectedHeadCount={card.projectedHeadCount}
                  projectedMortality={card.projectedMortality}
                  weeklyMortality={card.weeklyMortality}
                  flockLabel={card.flockLabel}
                  houseFlockId={card.houseFlockId}
                  placementDateKey={card.placementDateKey}
                  catchDateKey={card.catchDateKey}
                  catchTime={card.catchTime}
                  birdAgeDays={card.birdAgeDays}
                />
              </div>
            );
          })}
          {model.houses.length === 0 ? (
            <Card>
              <p className="text-stone-600">No houses yet. Add one below.</p>
            </Card>
          ) : null}
        </div>
      </ExclusiveSwipeGroup>

      <AddHouseForm farmId={farm.id} />

      <AddFlockSection
        farmId={farm.id}
        action={submitFlock}
        hasActiveFlock={model.activeFlocks.length > 0}
        activeFlockCount={model.activeFlocks.length}
        houses={model.addFlockHouses}
        initialPlacement={appTodayKey(undefined, resolveAppTimeZone(timeZone))}
        open={addFlockOpen}
        onOpenChange={setAddFlockOpen}
      />
    </div>
  );
}
