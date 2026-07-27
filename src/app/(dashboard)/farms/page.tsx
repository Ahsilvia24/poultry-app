import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteFarmButton } from "@/components/FarmOpsForms";
import { Button, Card, PageHeader } from "@/components/ui";
import { summarizeForDate } from "@/lib/mortality/calculations";
import { cn, formatNumber } from "@/lib/utils";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

type SearchParams = Promise<{ status?: string }>;

export default async function FarmsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active";
  const today = new Date();

  const farms = await prisma.farm.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    },
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
    orderBy: { farmName: "asc" },
  });

  const filters = [
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "all", label: "All" },
  ] as const;

  return (
    <div>
      <PageHeader title="Farms" subtitle="Manage grower farms and houses" />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "active" ? "/farms" : `/farms?status=${f.key}`}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold",
              status === f.key ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-800",
            )}
          >
            {f.label}
          </Link>
        ))}
        <Link
          href="/farms/new"
          className="rounded-lg bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-800"
        >
          Add Farm
        </Link>
      </div>

      {farms.length === 0 ? (
        <Card>
          <p className="text-stone-600">No farms found for this filter.</p>
          <Link href="/farms/new" className="mt-3 inline-block">
            <Button>Add your first farm</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {farms.map((farm) => {
            const activeFlocks = farm.flocks;
            const active = activeFlocks[0];
            const houseCount = farm.houses.length;
            const birdsPlaced =
              activeFlocks.length > 0
                ? activeFlocks.reduce(
                    (sum, fl) =>
                      sum + fl.houseFlocks.reduce((s, hf) => s + hf.placedBirdCount, 0),
                    0,
                  )
                : null;
            const currentHeadCount =
              activeFlocks.length > 0
                ? activeFlocks.reduce((sum, fl) => {
                    return (
                      sum +
                      fl.houseFlocks.reduce((s, hf) => {
                        const metrics = summarizeForDate(hf.placedBirdCount, hf.mortalities, today);
                        return s + metrics.remaining;
                      }, 0)
                    );
                  }, 0)
                : null;
            const flockAges = Array.from(
              new Set(
                activeFlocks.map((fl) => differenceInCalendarDays(today, fl.placementDate)),
              ),
            ).sort((a, b) => a - b);
            const earliestCatch = activeFlocks
              .map((fl) => fl.projectedCatchDate)
              .filter((d): d is Date => d != null)
              .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

            return (
              <Card key={farm.id} className="transition hover:border-emerald-400">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/farms/${farm.id}`} className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-stone-900">
                      {farm.farmName}
                      <span className="font-semibold text-stone-500">
                        {" "}
                        ({houseCount})
                      </span>
                      {flockAges.length > 0 ? (
                        <span className="font-semibold text-stone-500">
                          {" "}
                          · {flockAges.map((a) => `${a}d`).join(" · ")}
                        </span>
                      ) : null}
                    </p>
                    {farm.growerName || farm.phoneNumber ? (
                      <p className="text-sm text-stone-600">
                        {[farm.growerName, farm.phoneNumber].filter(Boolean).join("  ")}
                      </p>
                    ) : null}
                  </Link>
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
                    <Link
                      href={`/farms/${farm.id}`}
                      aria-label={`Edit ${farm.farmName}`}
                      title="Edit"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 hover:text-stone-900"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
                <Link href={`/farms/${farm.id}`} className="mt-4 block">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-stone-500">Birds placed</p>
                      <p className="font-semibold">
                        {birdsPlaced != null ? formatNumber(birdsPlaced) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Placement date</p>
                      <p className="font-semibold">
                        {active
                          ? format(active.placementDate, "EEE, MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Current Head Count</p>
                      <p className="font-semibold">
                        {currentHeadCount != null ? formatNumber(currentHeadCount) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Catch date</p>
                      <p className="font-semibold">
                        {earliestCatch
                          ? format(earliestCatch, "EEE, MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="mt-1 flex justify-end">
                  <DeleteFarmButton farmId={farm.id} appearance="icon" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
