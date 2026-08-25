import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLastFeedOrderAction } from "@/app/actions/lfo";
import { LfoInventoryForm } from "@/components/LfoInventoryForm";
import { Card, PageHeader } from "@/components/ui";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  feedUpFromCatch,
  formatLocalDateTime,
} from "@/lib/lfo/calculate";
import { getFarmHouseHeadCounts } from "@/lib/lfo/head-counts";

type Params = Promise<{ farmId: string }>;

export default async function NewLfoForFarmPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { farmId } = await params;

  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId: session.user.id, deletedAt: null },
    include: {
      houses: {
        where: { deletedAt: null },
        orderBy: { houseNumber: "asc" },
      },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "desc" },
        include: {
          houseFlocks: {
            select: { houseId: true, catchDate: true, catchTime: true },
          },
        },
      },
    },
  });

  if (!farm) notFound();
  if (farm.flocks.length === 0 || farm.houses.length === 0) {
    redirect("/lfo/new");
  }

  const headCounts = await getFarmHouseHeadCounts(farm.id);
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

  function feedUpPrefill(houseId: string): string | null {
    const info = catchByHouse.get(houseId);
    if (!info?.catchTime) return null;
    const catchDate = info.catchDate ?? info.flockCatch;
    if (!catchDate) return null;
    const feedUp = feedUpFromCatch(format(catchDate, "yyyy-MM-dd"), info.catchTime);
    return feedUp ? formatLocalDateTime(feedUp) : null;
  }

  async function submit(formData: FormData) {
    "use server";
    return createLastFeedOrderAction(farmId, formData);
  }

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div>
      <Link
        href="/lfo/new"
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ←
        </span>
        Choose farm
      </Link>
      <PageHeader title={farm.farmName} />

      <Card>
        <LfoInventoryForm
          action={submit}
          farmName={farm.farmName}
          orderDate={today}
          consumptionRate={DEFAULT_LFO_CONSUMPTION_RATE}
          submitLabel="Save LFO"
          houses={farm.houses.map((h) => ({
            houseId: h.id,
            houseNumber: h.houseNumber,
            binAPounds: 0,
            binBPounds: 0,
            feedUpAt: feedUpPrefill(h.id),
            headCount: headCounts.get(h.id) ?? 0,
          }))}
        />
      </Card>
    </div>
  );
}
