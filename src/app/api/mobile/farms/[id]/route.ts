import { NextRequest } from "next/server";
import { format } from "date-fns";
import { jsonError, requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_THRESHOLDS,
  isRisingThreeDays,
  resolveMortalityStatus,
  summarizeForDate,
} from "@/lib/mortality/calculations";
import { cfmPerSquareFoot } from "@/lib/ventilation/calculations";
import { getUserThresholds } from "@/lib/dashboard";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  const { id } = await params;

  const farm = await prisma.farm.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        take: 1,
        include: {
          houseFlocks: {
            include: {
              house: true,
              mortalities: { where: { isDraft: false }, orderBy: { mortalityDate: "asc" } },
              feedDeliveries: true,
            },
          },
        },
      },
      issues: { where: { status: { not: "RESOLVED" } }, take: 10, orderBy: { dateReported: "desc" } },
    },
  });
  if (!farm) return jsonError("Farm not found", 404);

  const thresholds = await getUserThresholds(user.id);
  const today = new Date();
  const active = farm.flocks[0] ?? null;

  const houses = farm.houses.map((house) => {
    const hf = active?.houseFlocks.find((h) => h.houseId === house.id) ?? null;
    const metrics = hf ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today) : null;
    const rising = hf ? isRisingThreeDays(hf.mortalities, today) : false;
    const status = metrics
      ? resolveMortalityStatus(
          { dailyPct: metrics.dailyPct, sevenDayPct: metrics.sevenDayPct, risingThreeDays: rising },
          thresholds ?? DEFAULT_THRESHOLDS,
        )
      : "Normal";

    return {
      id: house.id,
      houseNumber: house.houseNumber,
      squareFootage: house.squareFootage,
      totalFanCFM: house.totalFanCFM,
      totalPowerCFM: house.totalPowerCFM,
      cfmPerSqFt: cfmPerSquareFoot(house.totalFanCFM, house.squareFootage),
      houseFlockId: hf?.id ?? null,
      placedBirdCount: hf?.placedBirdCount ?? null,
      todayMortality: metrics?.today ?? 0,
      sevenDayMortality: metrics?.sevenDay ?? 0,
      cumulativeMortality: metrics?.cumulative ?? 0,
      cumulativeMortalityPct: metrics?.cumulativePct ?? 0,
      remainingBirdCount: metrics?.remaining ?? hf?.placedBirdCount ?? null,
      status,
    };
  });

  return Response.json({
    farm: {
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      notes: farm.notes,
    },
    activeFlock: active
      ? {
          id: active.id,
          flockNumber: active.flockNumber,
          placementDate: format(active.placementDate, "yyyy-MM-dd"),
          projectedCatchDate: active.projectedCatchDate
            ? format(active.projectedCatchDate, "yyyy-MM-dd")
            : null,
        }
      : null,
    houses,
    openIssues: farm.issues.map((i) => ({
      id: i.id,
      priority: i.priority,
      category: i.category,
      description: i.description,
      status: i.status,
    })),
  });
}
