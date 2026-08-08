import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLastFeedOrderAction } from "@/app/actions/lfo";
import { LfoInventoryForm } from "@/components/LfoInventoryForm";
import { Card, PageHeader } from "@/components/ui";
import { DEFAULT_LFO_CONSUMPTION_RATE } from "@/lib/lfo/calculate";
import { getFlockHouseHeadCounts } from "@/lib/lfo/head-counts";

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
        take: 1,
        select: { id: true, flockNumber: true },
      },
    },
  });

  if (!farm) notFound();
  if (farm.flocks.length === 0 || farm.houses.length === 0) {
    redirect("/lfo/new");
  }

  const flock = farm.flocks[0]!;
  const headCounts = await getFlockHouseHeadCounts(flock.id);

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
            feedUpAt: null,
            headCount: headCounts.get(h.id) ?? 0,
          }))}
        />
      </Card>
    </div>
  );
}
