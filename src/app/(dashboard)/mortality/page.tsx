import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const farmsRaw = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null, isActive: true },
    orderBy: { farmName: "asc" },
    include: {
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        take: 1,
        include: {
          houseFlocks: {
            include: {
              house: true,
              mortalities: {
                orderBy: { mortalityDate: "asc" },
              },
            },
            orderBy: { house: { houseNumber: "asc" } },
          },
        },
      },
    },
  });

  const farms: MortalityFarmPayload[] = farmsRaw.map((farm) => {
    const active = farm.flocks[0] ?? null;
    return {
      id: farm.id,
      farmName: farm.farmName,
      activeFlock: active
        ? {
            id: active.id,
            flockNumber: active.flockNumber,
            placementDate: format(active.placementDate, "yyyy-MM-dd"),
            projectedCatchDate: active.projectedCatchDate
              ? format(active.projectedCatchDate, "yyyy-MM-dd")
              : null,
            targetMarketAge: active.targetMarketAge,
            houses: active.houseFlocks.map((hf) => ({
              houseFlockId: hf.id,
              houseNumber: hf.house.houseNumber,
              placedBirdCount: hf.placedBirdCount,
              existingEntries: hf.mortalities.map((m) => ({
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
      <PageHeader
        title="Mortality entry"
      />
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
