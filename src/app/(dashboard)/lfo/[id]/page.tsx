import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteLastFeedOrderAction,
  updateLastFeedOrderAction,
} from "@/app/actions/lfo";
import { LfoInventoryForm } from "@/components/LfoInventoryForm";
import { Card, PageHeader } from "@/components/ui";
import { calculateLastFeedOrder } from "@/lib/lfo/calculate";

type Params = Promise<{ id: string }>;

export default async function EditLfoPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const lfo = await prisma.lastFeedOrder.findFirst({
    where: { id, farm: { userId: session.user.id, deletedAt: null } },
    include: {
      farm: { select: { id: true, farmName: true } },
      flock: { select: { flockNumber: true } },
      houseInventories: true,
    },
  });

  if (!lfo) notFound();

  const houses = await prisma.house.findMany({
    where: { farmId: lfo.farm.id, deletedAt: null },
    orderBy: { houseNumber: "asc" },
  });

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
    };
  });

  const calc = calculateLastFeedOrder({
    orderDate: format(lfo.orderDate, "yyyy-MM-dd"),
    houses: houseRows,
  });

  async function submit(formData: FormData) {
    "use server";
    return updateLastFeedOrderAction(id, formData);
  }

  async function remove() {
    "use server";
    await deleteLastFeedOrderAction(id);
  }

  return (
    <div>
      <Link
        href="/lfo"
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ←
        </span>
        LFOs
      </Link>
      <PageHeader
        title={lfo.farm.farmName}
        subtitle={`Flock ${lfo.flock.flockNumber} — edit last feed order`}
      />

      <Card>
        <LfoInventoryForm
          action={submit}
          orderDate={format(lfo.orderDate, "yyyy-MM-dd")}
          notes={lfo.notes}
          submitLabel="Save changes"
          deleteAction={remove}
          houses={houseRows}
        />
      </Card>

      {!calc.ready ? (
        <p className="mt-4 text-sm text-stone-500">
          Feed order calculation will appear here once the formula is set.
        </p>
      ) : null}
    </div>
  );
}
