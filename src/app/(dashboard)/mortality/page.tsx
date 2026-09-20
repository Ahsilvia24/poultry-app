import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appTodayKey } from "@/lib/app-calendar";
import { ensureActiveFlockHouseFlocksForUser } from "@/lib/ensureActiveFlockHouseFlocks";
import { listMortalityHouses } from "@/lib/mortalityHouses";
import { MANUAL_LFO_FARM_NAME, MANUAL_LFO_FARM_NUMBER } from "@/lib/lfo/manualFarm";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { VISIT_PLACE_FARM_NUMBER } from "@/lib/visits/visitPlace";
import { dateKeyFromDb } from "@/lib/visits/schedule";
import { PageHeader } from "@/components/ui";
import {
  MortalityEntryForm,
  type MortalityFarmPayload,
} from "@/components/MortalityEntryForm";

type SearchParams = Promise<{ farmId?: string; houseFlockId?: string }>;

export default async function MortalityPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  try {
  const timeZone = await getUserTimeZone(session.user.id);

  // Houses added after the flock was created never got a HouseFlock row.
  await ensureActiveFlockHouseFlocksForUser(session.user.id);

  const farmsRaw = await prisma.farm.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      isActive: true,
      farmNumber: { notIn: [VISIT_PLACE_FARM_NUMBER, MANUAL_LFO_FARM_NUMBER] },
      farmName: { not: MANUAL_LFO_FARM_NAME },
    },
    orderBy: { farmName: "asc" },
    include: {
      houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: [{ placementDate: "asc" }, { flockNumber: "asc" }],
        include: {
          houseFlocks: {
            where: { house: { deletedAt: null } },
            include: {
              mortalities: {
                orderBy: { mortalityDate: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const farms: MortalityFarmPayload[] = farmsRaw.map((farm) => {
    const active = farm.flocks[0] ?? null;
    const houses = listMortalityHouses(
      farm.houses,
      farm.flocks.flatMap((flock) =>
        flock.houseFlocks.map((hf) => ({ ...hf, flockId: flock.id })),
      ),
    );
    return {
      id: farm.id,
      farmName: farm.farmName,
      activeFlock: active
        ? {
            id: active.id,
            flockNumber:
              farm.flocks.length > 1
                ? farm.flocks.map((flock) => flock.flockNumber).join(" · ")
                : active.flockNumber,
            placementDate: dateKeyFromDb(active.placementDate),
            projectedCatchDate: active.projectedCatchDate
              ? dateKeyFromDb(active.projectedCatchDate)
              : null,
            targetMarketAge: active.targetMarketAge,
            houses: houses.map(({ house, houseFlock }) => {
              const houseFlockRecord = farm.flocks.find((row) => row.id === houseFlock.flockId) ?? active;
              return {
              houseFlockId: houseFlock.id,
              houseId: house.id,
              flockId: houseFlock.flockId,
              houseNumber: house.houseNumber,
              placedBirdCount: houseFlock.placedBirdCount,
              placementDate: houseFlock.placementDate
                ? dateKeyFromDb(houseFlock.placementDate)
                : dateKeyFromDb(houseFlockRecord.placementDate),
              existingEntries: houseFlock.mortalities.map((m) => ({
                // Use UTC calendar date so keys match form day keys (avoid TZ off-by-one)
                mortalityDate: m.mortalityDate.toISOString().slice(0, 10),
                dailyMortalityCount: m.dailyMortalityCount,
                cullCount: m.cullCount,
                birdAgeInDays: m.birdAgeInDays,
                mortalityCause: m.mortalityCause,
                comments: m.comments,
                isDraft: m.isDraft,
              })),
              };
            }),
          }
        : null,
    };
  });

  // Stable calendar day for SSR + client first paint (avoids hydration age mismatch).
  const asOfDateKey = appTodayKey(undefined, timeZone);

  return (
    <div>
      <PageHeader title="Mortality Entry" />
      {farms.length === 0 ? (
        <p className="text-stone-600">Add an active farm with a flock to enter mortality.</p>
      ) : (
        <MortalityEntryForm
          farms={farms}
          initialFarmId={params.farmId}
          initialHouseFlockId={params.houseFlockId}
          asOfDateKey={asOfDateKey}
        />
      )}
    </div>
  );
  } catch {
    return (
      <div>
        <PageHeader title="Mortality Entry" />
        <p className="text-stone-600">Add an active farm with a flock to enter mortality.</p>
      </div>
    );
  }
}
