import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { LfoHub } from "@/components/LfoHub";
import {
  calculateLastFeedOrder,
  catchPartsFromFeedUpAt,
  formatHouseLfoSummary,
} from "@/lib/lfo/calculate";
import type { LfoShareInventory } from "@/lib/lfo/share-payload";
import { getFarmHouseHeadCounts } from "@/lib/lfo/head-counts";
import { lfoDisplayName } from "@/lib/lfo/customName";
import type { FarmLfoHouseInput } from "@/components/FarmLfoForm";

/** Date-only → "7-26-2026" (no leading zeros). */
function formatLfoDate(d: Date) {
  return `${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCFullYear()}`;
}

type SearchParams = Promise<{ farmId?: string }>;

export default async function LfoPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = searchParams ? await searchParams : {};
  const initialFarmId = typeof sp.farmId === "string" ? sp.farmId : undefined;

  const [farms, savedLfos] = await Promise.all([
    prisma.farm.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        isActive: true,
        flocks: { some: { flockStatus: "ACTIVE", deletedAt: null } },
        houses: { some: { deletedAt: null } },
      },
      select: {
        id: true,
        farmName: true,
        houses: {
          where: { deletedAt: null },
          orderBy: { houseNumber: "asc" },
          select: { id: true, houseNumber: true },
        },
        flocks: {
          where: { flockStatus: "ACTIVE", deletedAt: null },
          orderBy: { placementDate: "desc" },
          select: {
            actualCatchDate: true,
            projectedCatchDate: true,
            houseFlocks: {
              select: { houseId: true, catchDate: true, catchTime: true },
            },
          },
        },
      },
      orderBy: { farmName: "asc" },
    }),
    prisma.lastFeedOrder.findMany({
      where: { farm: { userId: session.user.id, deletedAt: null } },
      include: {
        farm: { select: { farmName: true } },
        houseInventories: {
          include: { house: { select: { houseNumber: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }, { orderDate: "desc" }],
    }),
  ]);

  const farmsNeedingLiveHeads = [
    ...new Set([
      ...farms.map((farm) => farm.id),
      ...savedLfos
        .filter((lfo) => lfo.houseInventories.some((inv) => inv.headCount == null))
        .map((l) => l.farmId),
    ]),
  ];
  const headCountByFarm = new Map<string, Map<string, number>>();
  await Promise.all(
    farmsNeedingLiveHeads.map(async (farmId) => {
      headCountByFarm.set(farmId, await getFarmHouseHeadCounts(farmId));
    }),
  );

  const farmsWithHouses = farms.map((farm) => {
    const heads = headCountByFarm.get(farm.id) ?? new Map();
    const catchByHouse = new Map<
      string,
      { catchDate: Date | null; catchTime: string | null; flockCatch: Date | null }
    >();
    for (const flock of farm.flocks) {
      const flockCatch = flock.actualCatchDate ?? flock.projectedCatchDate ?? null;
      for (const hf of flock.houseFlocks) {
        if (catchByHouse.has(hf.houseId)) continue;
        catchByHouse.set(hf.houseId, {
          catchDate: hf.catchDate,
          catchTime: hf.catchTime,
          flockCatch,
        });
      }
    }
    const houses: FarmLfoHouseInput[] = farm.houses.map((house) => {
      const info = catchByHouse.get(house.id);
      const catchDate = info?.catchDate ?? info?.flockCatch ?? null;
      return {
        houseId: house.id,
        houseNumber: house.houseNumber,
        headCount: heads.get(house.id) ?? 0,
        catchDate: catchDate ? format(catchDate, "yyyy-MM-dd") : "",
        catchTime: info?.catchTime?.trim() || "",
      };
    });
    return { id: farm.id, farmName: farm.farmName, houses };
  });

  const savedWithSummary = savedLfos.map((lfo) => {
    const liveHeads = headCountByFarm.get(lfo.farmId) ?? new Map();
    const orderDateKey = lfo.orderDate.toISOString().slice(0, 10);
    const houses = lfo.houseInventories
      .map((inv) => {
        const catchParts = catchPartsFromFeedUpAt(inv.feedUpAt);
        return {
          houseId: inv.houseId,
          houseNumber: inv.house.houseNumber,
          binAPounds: inv.binAPounds,
          binBPounds: inv.binBPounds,
          catchDate: catchParts.date,
          catchTime: catchParts.time,
          headCount: inv.headCount ?? liveHeads.get(inv.houseId) ?? 0,
        };
      })
      .sort((a, b) => a.houseNumber - b.houseNumber);
    const calc = calculateLastFeedOrder({
      orderDate: orderDateKey,
      orderTime: lfo.orderTime,
      consumptionRate: lfo.consumptionRate,
      houses: lfo.houseInventories.map((inv) => ({
        houseId: inv.houseId,
        houseNumber: inv.house.houseNumber,
        binAPounds: inv.binAPounds,
        binBPounds: inv.binBPounds,
        feedUpAt: inv.feedUpAt,
        headCount: inv.headCount ?? liveHeads.get(inv.houseId) ?? 0,
      })),
    });
    const displayName = lfoDisplayName(lfo.farm.farmName, lfo.notes);
    const shareInventory: LfoShareInventory = {
      farmName: displayName,
      orderDate: orderDateKey,
      orderTime: lfo.orderTime,
      consumptionRate: lfo.consumptionRate,
      calculatedAt: (lfo.calculatedAt ?? lfo.createdAt).toISOString(),
      notes: lfo.notes,
      houses,
    };
    return {
      id: lfo.id,
      farmName: displayName,
      dateLabel: formatLfoDate(lfo.orderDate),
      houseSummary: formatHouseLfoSummary(calc.houses),
      shareInventory,
    };
  });

  return (
    <div>
      <PageHeader title="Last Feed Order" />
      <LfoHub
        key={initialFarmId ?? "manual"}
        farms={farmsWithHouses}
        savedLfos={savedWithSummary}
        initialFarmId={initialFarmId}
      />
    </div>
  );
}
