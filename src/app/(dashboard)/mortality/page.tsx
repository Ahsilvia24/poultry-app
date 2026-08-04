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

/** Local calendar day (not UTC) so bird age matches the phone. */
function todayKeyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

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
        orderBy: { placementDate: "asc" },
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
    const activeFlocks = farm.flocks;
    if (activeFlocks.length === 0) {
      return { id: farm.id, farmName: farm.farmName, activeFlock: null };
    }

    const houses = activeFlocks
      .flatMap((flock) =>
        flock.houseFlocks.map((hf) => {
          const placement = hf.placementDate ?? flock.placementDate;
          const catchDate = hf.catchDate ?? flock.projectedCatchDate;
          return {
            houseFlockId: hf.id,
            houseNumber: hf.house.houseNumber,
            placedBirdCount: hf.placedBirdCount,
            flockId: flock.id,
            placementDate: dateKey(placement),
            projectedCatchDate: catchDate ? dateKey(catchDate) : null,
            targetMarketAge: flock.targetMarketAge,
            existingEntries: hf.mortalities.map((m) => ({
              // Use UTC calendar date so keys match form day keys (avoid TZ off-by-one)
              mortalityDate: m.mortalityDate.toISOString().slice(0, 10),
              dailyMortalityCount: m.dailyMortalityCount,
              cullCount: m.cullCount,
              mortalityCause: m.mortalityCause,
              comments: m.comments,
              isDraft: m.isDraft,
            })),
          };
        }),
      )
      .sort((a, b) => a.houseNumber - b.houseNumber);

    const primary = activeFlocks[0]!;
    return {
      id: farm.id,
      farmName: farm.farmName,
      activeFlock: {
        id: primary.id,
        flockNumber:
          activeFlocks.length > 1
            ? activeFlocks.map((f) => f.flockNumber).join(" · ")
            : primary.flockNumber,
        placementDate: dateKey(primary.placementDate),
        projectedCatchDate: primary.projectedCatchDate
          ? dateKey(primary.projectedCatchDate)
          : null,
        targetMarketAge: primary.targetMarketAge,
        houses,
      },
    };
  });

  // Stable calendar day for SSR + client first paint (avoids hydration age mismatch).
  const asOfDateKey = todayKeyLocal();

  return (
    <div>
      <PageHeader title="Mortality entry" />
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
