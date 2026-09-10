import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureActiveFlockHouseFlocksForUser } from "@/lib/ensureActiveFlockHouseFlocks";
import { listMortalityHouses } from "@/lib/mortalityHouses";
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

  // Houses added after the flock was created never got a HouseFlock row.
  await ensureActiveFlockHouseFlocksForUser(session.user.id);

  const farmsRaw = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null, isActive: true },
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
            placementDate: format(active.placementDate, "yyyy-MM-dd"),
            projectedCatchDate: active.projectedCatchDate
              ? format(active.projectedCatchDate, "yyyy-MM-dd")
              : null,
            targetMarketAge: active.targetMarketAge,
            houses: houses.map(({ house, houseFlock }) => ({
              houseFlockId: houseFlock.id,
              flockId: houseFlock.flockId,
              houseNumber: house.houseNumber,
              placedBirdCount: houseFlock.placedBirdCount,
              existingEntries: houseFlock.mortalities.map((m) => ({
                // Use UTC calendar date so keys match form day keys (avoid TZ off-by-one)
                mortalityDate: m.mortalityDate.toISOString().slice(0, 10),
                dailyMortalityCount: m.dailyMortalityCount,
                cullCount: m.cullCount,
                mortalityCause: m.mortalityCause,
                comments: m.comments,
                isDraft: m.isDraft,
              })),
            })),
          }
        : null,
    };
  });

  // Stable calendar day for SSR + client first paint (avoids hydration age mismatch).
  const asOfDateKey = new Date().toISOString().slice(0, 10);

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
}
