import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteLastFeedOrderAction,
  saveAsNewLastFeedOrderAction,
  updateLastFeedOrderAction,
} from "@/app/actions/lfo";
import { LfoInventoryForm } from "@/components/LfoInventoryForm";
import { BackHeader, Card } from "@/components/ui";
import { getFarmHouseHeadCounts } from "@/lib/lfo/head-counts";
import { catchPartsFromFeedUpAt, lfoTimingFromSettings } from "@/lib/lfo/calculate";
import { lfoDisplayName } from "@/lib/lfo/customName";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { dateKeyFromDb } from "@/lib/visits/schedule";

type Params = Promise<{ id: string }>;

export default async function EditLfoPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const timeZone = await getUserTimeZone(session.user.id);

  const [lfo, settings] = await Promise.all([
    prisma.lastFeedOrder.findFirst({
      where: { id, farm: { userId: session.user.id, deletedAt: null } },
      include: {
        farm: { select: { id: true, farmName: true } },
        houseInventories: true,
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { lfoFeedUpHoursBeforeCatch: true, lfoFeedOffHoursBeforeCatch: true },
    }),
  ]);

  if (!lfo) notFound();

  const displayName = lfoDisplayName(lfo.farm.farmName, lfo.notes);
  const asOf = lfo.calculatedAt ?? lfo.createdAt;
  const needsLiveHeads = lfo.houseInventories.some((inv) => inv.headCount == null);
  const timing = lfoTimingFromSettings(settings);
  const [houses, liveHeads] = await Promise.all([
    prisma.house.findMany({
      where: { farmId: lfo.farm.id, deletedAt: null },
      orderBy: { houseNumber: "asc" },
    }),
    needsLiveHeads ? getFarmHouseHeadCounts(lfo.farm.id) : Promise.resolve(new Map<string, number>()),
  ]);

  const invByHouse = new Map(
    lfo.houseInventories.map((h) => [h.houseId, h] as const),
  );

  const houseRows = houses.map((h) => {
    const inv = invByHouse.get(h.id);
    const catchParts = catchPartsFromFeedUpAt(inv?.feedUpAt, timing, timeZone);
    return {
      houseId: h.id,
      houseNumber: h.houseNumber,
      binAPounds: inv?.binAPounds ?? 0,
      binBPounds: inv?.binBPounds ?? 0,
      catchDate: catchParts.date,
      catchTime: catchParts.time,
      headCount: inv?.headCount ?? liveHeads.get(h.id) ?? 0,
    };
  });

  async function submit(formData: FormData) {
    "use server";
    return updateLastFeedOrderAction(id, formData);
  }

  async function saveAsNew(formData: FormData) {
    "use server";
    return saveAsNewLastFeedOrderAction(id, formData);
  }

  async function remove() {
    "use server";
    await deleteLastFeedOrderAction(id);
    redirect("/lfo");
  }

  return (
    <div>
      <BackHeader
        href="/lfo"
        backLabel="LFOs"
        title={displayName}
        subtitle="Edit last feed order"
      />

      <Card>
        <LfoInventoryForm
          action={submit}
          saveAsNewAction={saveAsNew}
          farmName={displayName}
          orderDate={dateKeyFromDb(lfo.orderDate)}
          orderTime={lfo.orderTime}
          consumptionRate={lfo.consumptionRate}
          asOf={asOf}
          notes={lfo.notes}
          submitLabel="Save changes"
          deleteAction={remove}
          houses={houseRows}
        />
      </Card>
    </div>
  );
}
