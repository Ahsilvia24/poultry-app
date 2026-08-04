import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteLastFeedOrderAction,
  updateLastFeedOrderAction,
} from "@/app/actions/lfo";
import { LfoInventoryForm } from "@/components/LfoInventoryForm";
import { PageTitleBackLink } from "@/components/PageTitleBackLink";
import { Card, PAGE_TITLE_CLASS } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getFlockHouseHeadCounts } from "@/lib/lfo/head-counts";

type Params = Promise<{ id: string }>;

function toDatetimeLocalValue(d: Date | null | undefined): string | null {
  if (!d) return null;
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default async function EditLfoPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const lfo = await prisma.lastFeedOrder.findFirst({
    where: { id, farm: { userId: session.user.id, deletedAt: null } },
    include: {
      farm: { select: { id: true, farmName: true } },
      flock: { select: { id: true, flockNumber: true } },
      houseInventories: true,
    },
  });

  if (!lfo) notFound();

  const [houses, headCounts] = await Promise.all([
    prisma.house.findMany({
      where: { farmId: lfo.farm.id, deletedAt: null },
      orderBy: { houseNumber: "asc" },
    }),
    getFlockHouseHeadCounts(lfo.flock.id),
  ]);

  const invByHouse = new Map(
    lfo.houseInventories.map((h) => [h.houseId, h] as const),
  );

  const houseRows = houses.map((h) => {
    const inv = invByHouse.get(h.id);
    return {
      houseId: h.id,
      houseNumber: h.houseNumber,
      binAPounds: inv?.binAPounds ?? 0,
      binBPounds: inv?.binBPounds ?? 0,
      feedUpAt: toDatetimeLocalValue(inv?.feedUpAt),
      headCount: headCounts.get(h.id) ?? 0,
    };
  });

  async function submit(formData: FormData) {
    "use server";
    return updateLastFeedOrderAction(id, formData);
  }

  async function remove() {
    "use server";
    await deleteLastFeedOrderAction(id);
    redirect("/lfo");
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <PageTitleBackLink href="/lfo" label="LFOs" />
        <h1 className={cn(PAGE_TITLE_CLASS, "min-w-0 truncate text-right")}>
          {lfo.farm.farmName}
        </h1>
      </div>
      <p className="mb-6 text-stone-600">
        Flock {lfo.flock.flockNumber} — edit last feed order
      </p>

      <Card>
        <LfoInventoryForm
          action={submit}
          farmName={lfo.farm.farmName}
          orderDate={format(lfo.orderDate, "yyyy-MM-dd")}
          consumptionRate={lfo.consumptionRate}
          submitLabel="Save changes"
          deleteAction={remove}
          houses={houseRows}
        />
      </Card>
    </div>
  );
}
