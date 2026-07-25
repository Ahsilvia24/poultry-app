import { NextRequest } from "next/server";
import { format } from "date-fns";
import { jsonError, requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { getUserThresholds } from "@/lib/dashboard";
import {
  buildMortalitySummaries,
  calcTotalDailyLoss,
  DEFAULT_THRESHOLDS,
  MORTALITY_DISCLAIMER,
  resolveMortalityStatus,
} from "@/lib/mortality/calculations";

export async function GET(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const farmId = req.nextUrl.searchParams.get("farmId");
  const date = req.nextUrl.searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");

  const farms = await prisma.farm.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      isActive: true,
      ...(farmId ? { id: farmId } : {}),
    },
    include: {
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        take: 1,
        include: {
          houseFlocks: {
            include: {
              house: true,
              mortalities: { where: { isDraft: false }, orderBy: { mortalityDate: "asc" } },
            },
            orderBy: { house: { houseNumber: "asc" } },
          },
        },
      },
    },
    orderBy: { farmName: "asc" },
  });

  const thresholds = await getUserThresholds(user.id);

  return Response.json({
    date,
    disclaimer: MORTALITY_DISCLAIMER,
    thresholds: thresholds ?? DEFAULT_THRESHOLDS,
    farms: farms.map((farm) => {
      const flock = farm.flocks[0] ?? null;
      return {
        id: farm.id,
        farmName: farm.farmName,
        activeFlock: flock
          ? {
              id: flock.id,
              flockNumber: flock.flockNumber,
              placementDate: flock.placementDate,
              houses: flock.houseFlocks.map((hf) => {
                const existing = hf.mortalities.find(
                  (m) => format(m.mortalityDate, "yyyy-MM-dd") === date,
                );
                const summaries = buildMortalitySummaries(hf.placedBirdCount, hf.mortalities);
                const latest = summaries[summaries.length - 1];
                return {
                  houseFlockId: hf.id,
                  houseNumber: hf.house.houseNumber,
                  placedBirdCount: hf.placedBirdCount,
                  existing: existing
                    ? {
                        dailyMortalityCount: existing.dailyMortalityCount,
                        cullCount: existing.cullCount,
                        mortalityCause: existing.mortalityCause,
                        comments: existing.comments,
                      }
                    : null,
                  rolling7Day: latest?.rolling7DayMortalityCount ?? 0,
                  cumulative: latest?.cumulativeMortalityCount ?? 0,
                  cumulativePct: latest?.cumulativeMortalityPercentage ?? 0,
                  remaining: latest?.remainingBirdCount ?? hf.placedBirdCount,
                };
              }),
            }
          : null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.flockId || !body?.mortalityDate || !Array.isArray(body?.entries)) {
    return jsonError("Invalid payload");
  }

  // Reuse server action logic via direct call pattern
  const { saveMortalityBatchAction } = await import("@/app/actions/mortality");

  // saveMortalityBatchAction uses requireUser() from NextAuth session — won't work for mobile.
  // Inline the upsert here instead.
  const flock = await prisma.flock.findFirst({
    where: {
      id: body.flockId,
      farm: { userId: user.id, deletedAt: null },
    },
    include: {
      houseFlocks: { include: { mortalities: true, house: true } },
    },
  });
  if (!flock) return jsonError("Flock not found", 404);

  const { birdAgeFromPlacement, getLatestSummary } = await import("@/lib/mortality/calculations");
  const mortalityDate = new Date(body.mortalityDate);
  const birdAge = birdAgeFromPlacement(flock.placementDate, mortalityDate);
  const hfMap = new Map(flock.houseFlocks.map((hf) => [hf.id, hf]));

  for (const entry of body.entries) {
    const hf = hfMap.get(entry.houseFlockId);
    if (!hf) return jsonError("Invalid house flock");
    const loss = calcTotalDailyLoss(Number(entry.dailyMortalityCount), Number(entry.cullCount));
    const existingOther = hf.mortalities.filter(
      (m) => format(m.mortalityDate, "yyyy-MM-dd") !== body.mortalityDate,
    );
    const latest = getLatestSummary(hf.placedBirdCount, existingOther, mortalityDate);
    const remainingBefore = latest?.remainingBirdCount ?? hf.placedBirdCount;
    if (loss > remainingBefore) {
      return jsonError(`Daily loss cannot exceed remaining birds (${remainingBefore}) in a house.`);
    }
  }

  const saved = [];
  for (const entry of body.entries) {
    const loss = calcTotalDailyLoss(Number(entry.dailyMortalityCount), Number(entry.cullCount));
    const row = await prisma.dailyMortality.upsert({
      where: {
        houseFlockId_mortalityDate: {
          houseFlockId: entry.houseFlockId,
          mortalityDate,
        },
      },
      create: {
        houseFlockId: entry.houseFlockId,
        mortalityDate,
        birdAgeInDays: birdAge,
        dailyMortalityCount: Number(entry.dailyMortalityCount),
        cullCount: Number(entry.cullCount),
        totalDailyLoss: loss,
        mortalityCause: entry.mortalityCause ?? "UNKNOWN",
        comments: entry.comments ?? null,
        isDraft: Boolean(entry.isDraft),
        enteredByUserId: user.id,
      },
      update: {
        birdAgeInDays: birdAge,
        dailyMortalityCount: Number(entry.dailyMortalityCount),
        cullCount: Number(entry.cullCount),
        totalDailyLoss: loss,
        mortalityCause: entry.mortalityCause ?? "UNKNOWN",
        comments: entry.comments ?? null,
        isDraft: Boolean(entry.isDraft),
        enteredByUserId: user.id,
      },
    });
    saved.push(row);
  }

  // Build summary response
  const refreshed = await prisma.houseFlock.findMany({
    where: { flockId: flock.id },
    include: {
      house: true,
      mortalities: { where: { isDraft: false }, orderBy: { mortalityDate: "asc" } },
    },
    orderBy: { house: { houseNumber: "asc" } },
  });

  const thresholds = await getUserThresholds(user.id);
  const houseSummaries = refreshed.map((hf) => {
    const summaries = buildMortalitySummaries(hf.placedBirdCount, hf.mortalities);
    const forDate = summaries.find((s) => s.date === body.mortalityDate) ?? summaries[summaries.length - 1];
    const status = forDate
      ? resolveMortalityStatus(
          {
            dailyPct: forDate.dailyMortalityPercentage,
            sevenDayPct: forDate.rolling7DayMortalityPercentage,
          },
          thresholds ?? DEFAULT_THRESHOLDS,
        )
      : "Normal";
    return {
      houseNumber: hf.house.houseNumber,
      today: forDate?.totalDailyLoss ?? 0,
      sevenDay: forDate?.rolling7DayMortalityCount ?? 0,
      cumulative: forDate?.cumulativeMortalityCount ?? 0,
      cumulativePct: forDate?.cumulativeMortalityPercentage ?? 0,
      status,
    };
  });

  return Response.json({
    success: true,
    count: saved.length,
    birdAgeInDays: birdAge,
    disclaimer: MORTALITY_DISCLAIMER,
    houseSummaries,
    farmTotal: houseSummaries.reduce((s, h) => s + h.today, 0),
  });
}
