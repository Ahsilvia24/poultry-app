import { addDays, differenceInCalendarDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { summarizeForDate } from "@/lib/mortality/calculations";
import { cn, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui";

/** Temporary no-auth preview of the multi-flock farm tile. */
export default async function TriplePlacePreviewPage() {
  const today = new Date();
  const farm = await prisma.farm.findFirst({
    where: { farmName: "Triple Place", deletedAt: null },
    include: {
      houses: { where: { deletedAt: null }, select: { id: true } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "asc" },
        include: {
          houseFlocks: {
            include: {
              mortalities: {
                where: { isDraft: false },
                select: {
                  mortalityDate: true,
                  birdAgeInDays: true,
                  dailyMortalityCount: true,
                  cullCount: true,
                  totalDailyLoss: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!farm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-200 p-6">
        <Card>
          <p className="font-semibold">Triple Place farm not found.</p>
        </Card>
      </div>
    );
  }

  const activeFlocks = farm.flocks;
  const houseCount = farm.houses.length;
  const birdsPlaced = activeFlocks.reduce(
    (sum, fl) => sum + fl.houseFlocks.reduce((s, hf) => s + hf.placedBirdCount, 0),
    0,
  );
  const currentHeadCount = activeFlocks.reduce((sum, fl) => {
    return (
      sum +
      fl.houseFlocks.reduce((s, hf) => {
        const metrics = summarizeForDate(hf.placedBirdCount, hf.mortalities, today);
        return s + metrics.remaining;
      }, 0)
    );
  }, 0);
  const placementDates = Array.from(
    new Set(activeFlocks.map((fl) => format(fl.placementDate, "yyyy-MM-dd"))),
  ).sort();
  const catchDates = Array.from(
    new Set(
      activeFlocks.map((fl) =>
        format(fl.projectedCatchDate ?? addDays(fl.placementDate, 52), "yyyy-MM-dd"),
      ),
    ),
  ).sort();
  const flockAges = placementDates
    .map((d) => differenceInCalendarDays(today, new Date(`${d}T12:00:00`)))
    .filter((a, i, arr) => arr.indexOf(a) === i)
    .sort((a, b) => a - b);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d6d3d1] p-6">
      <div className="w-full max-w-md">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">
          Farms list — live preview
        </p>
        <Card className="transition hover:border-emerald-400">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-stone-900">
                {farm.farmName}
                <span className="font-semibold text-stone-500"> ({houseCount})</span>
                {flockAges.length > 0 ? (
                  <span className="font-semibold text-stone-500">
                    {" "}
                    {flockAges.map((a) => `${a}d`).join(" ")}
                  </span>
                ) : null}
              </p>
              {farm.growerName || farm.phoneNumber ? (
                <p className="text-sm text-stone-600">
                  {[farm.growerName, farm.phoneNumber].filter(Boolean).join("  ")}
                </p>
              ) : null}
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "inline-flex rounded-md px-2.5 py-1 text-sm font-bold",
                  farm.isActive
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-stone-100 text-stone-700",
                )}
              >
                {farm.isActive ? "Active" : "Inactive"}
              </span>
              <span
                aria-hidden
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-500"
              >
                ⚙
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-stone-500">Birds placed</p>
              <p className="font-semibold">{formatNumber(birdsPlaced)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                Placement date{placementDates.length > 1 ? "s" : ""}
              </p>
              {placementDates.map((d) => (
                <p key={d} className="font-semibold leading-snug">
                  {format(new Date(`${d}T12:00:00`), "EEE, MMM d, yyyy")}
                </p>
              ))}
            </div>
            <div>
              <p className="text-stone-500">Current Head Count</p>
              <p className="font-semibold">{formatNumber(currentHeadCount)}</p>
            </div>
            <div>
              <p className="text-stone-500">
                Catch date{catchDates.length > 1 ? "s" : ""}
              </p>
              {catchDates.map((d) => (
                <p key={d} className="font-semibold leading-snug">
                  {format(new Date(`${d}T12:00:00`), "EEE, MMM d, yyyy")}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-500"
            >
              🗑
            </span>
          </div>
          <div className="mt-2 border-t border-dashed border-stone-200 pt-2 text-xs text-stone-500">
            Flocks:{" "}
            {activeFlocks
              .map(
                (fl) =>
                  `${fl.flockNumber} (${differenceInCalendarDays(today, fl.placementDate)}d)`,
              )
              .join(" ")}
          </div>
        </Card>
      </div>
    </div>
  );
}
