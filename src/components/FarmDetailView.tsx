import { ReplicaLink } from "@/components/ReplicaLink";
import { createFlockAction } from "@/app/actions/farms";
import { HouseCard } from "@/components/HouseCard";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { AddFlockSection } from "@/components/AddFlockSection";
import { AddHouseForm } from "@/components/AddHouseForm";
import { FarmInfoEditor } from "@/components/FarmInfoEditor";
import { FarmQuickLinks } from "@/components/FarmQuickLinks";
import { FarmFeedSection } from "@/components/FarmFeedSection";
import { FarmGeneratorLogSection } from "@/components/FarmGeneratorLogSection";
import { FarmIssuesSection } from "@/components/FarmIssuesSection";
import { FarmLitterSection } from "@/components/FarmLitterSection";
import { FarmVisitsSection } from "@/components/FarmVisitsSection";
import { Card } from "@/components/ui";
import { appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import type { FarmDetailModel } from "@/lib/offline/selectFarmDetail";
import type { VisitType } from "@prisma/client";

export function FarmDetailView({
  model,
  timeZone,
}: {
  model: FarmDetailModel;
  timeZone?: string;
}) {
  const farm = model.farm;
  const houseById = new Map(model.houses.map((house) => [house.id, house]));

  async function submitFlock(formData: FormData) {
    return createFlockAction(farm.id, formData);
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
        <ReplicaLink
          href="/farms"
          className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ←
          </span>
          Farms
        </ReplicaLink>
        <FarmInfoEditor farm={farm} />
      </div>

      <div className="mb-6">
        <FarmQuickLinks farmId={farm.id} completeFlocks={model.activeFlocks} />
      </div>

      <ExclusiveSwipeGroup>
        <div className="mt-3 grid items-start gap-3 md:grid-cols-2">
          {model.houseCards.map((card) => {
            const house = houseById.get(card.houseId);
            if (!house) return null;
            return (
              <HouseCard
                key={house.id}
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
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <FarmVisitsSection
          farmId={farm.id}
          flockId={model.activeFlockId ?? undefined}
          placementDate={model.activePlacementDate}
          visits={model.visits.map((visit) => ({
            ...visit,
            visitType: visit.visitType as VisitType,
          }))}
        />

        <FarmGeneratorLogSection farmId={farm.id} logs={model.generatorLogs} />

        <FarmIssuesSection
          farmId={farm.id}
          flockId={model.activeFlockId ?? undefined}
          houses={model.houses.map((house) => ({ id: house.id, houseNumber: house.houseNumber }))}
          issues={model.issues}
        />

        <FarmLitterSection
          farmId={farm.id}
          houses={model.houses.map((house) => ({ id: house.id, houseNumber: house.houseNumber }))}
          events={model.litterEvents}
        />

        <FarmFeedSection
          farmId={farm.id}
          farms={model.feedFarms}
          deliveries={model.deliveries}
        />
      </div>
    </div>
  );
}
