import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";
import { FeedDeliveryForm, type FeedFarmOption } from "@/components/FeedDeliveryForm";

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const farmsRaw = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null, isActive: true },
    orderBy: { farmName: "asc" },
    include: {
      flocks: {
        where: { deletedAt: null },
        orderBy: [{ flockStatus: "asc" }, { placementDate: "desc" }],
        include: {
          houseFlocks: {
            include: { house: true },
            orderBy: { house: { houseNumber: "asc" } },
          },
        },
      },
    },
  });

  const farms: FeedFarmOption[] = farmsRaw.map((farm) => ({
    id: farm.id,
    farmName: farm.farmName,
    flocks: farm.flocks.map((flock) => ({
      id: flock.id,
      flockNumber: flock.flockNumber,
      status: flock.flockStatus,
      houses: flock.houseFlocks.map((hf) => ({
        houseFlockId: hf.id,
        houseNumber: hf.house.houseNumber,
      })),
    })),
  }));

  const deliveries = await prisma.feedDelivery.findMany({
    where: {
      OR: [
        { flock: { farm: { userId: session.user.id, deletedAt: null } } },
        { houseFlock: { flock: { farm: { userId: session.user.id, deletedAt: null } } } },
      ],
    },
    include: {
      flock: { include: { farm: true } },
      houseFlock: { include: { house: true, flock: { include: { farm: true } } } },
    },
    orderBy: { deliveryDate: "desc" },
    take: 40,
  });

  return (
    <div>
      <PageHeader title="Feed" subtitle="Record and review feed deliveries" />

      {farms.length === 0 ? (
        <Card>
          <p className="text-stone-600">Add a farm and flock before recording feed.</p>
        </Card>
      ) : (
        <FeedDeliveryForm farms={farms} />
      )}

      <h2 className="mt-8 text-xl font-bold">Recent deliveries</h2>
      <Card className="mt-3">
        <ul className="space-y-3 text-sm">
          {deliveries.length === 0 ? <li className="text-stone-500">No deliveries yet</li> : null}
          {deliveries.map((d) => {
            const farmName =
              d.flock?.farm.farmName ?? d.houseFlock?.flock.farm.farmName ?? "Unknown farm";
            const flockNumber = d.flock?.flockNumber ?? d.houseFlock?.flock.flockNumber;
            const houseNumber = d.houseFlock?.house.houseNumber;
            return (
              <li key={d.id} className="border-b border-stone-100 pb-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {farmName}
                    {flockNumber ? ` · Flock ${flockNumber}` : ""}
                    {houseNumber != null ? ` · House ${houseNumber}` : " · Flock-level"}
                  </p>
                  <p className="text-stone-500">{format(d.deliveryDate, "MMM d, yyyy")}</p>
                </div>
                <p className="mt-1">
                  {formatNumber(d.poundsDelivered)} lbs ({d.tonsDelivered.toFixed(2)} tons)
                  {d.feedType ? ` · ${d.feedType}` : ""}
                  {d.ticketNumber ? ` · Ticket ${d.ticketNumber}` : ""}
                </p>
                {d.notes ? <p className="text-stone-600">{d.notes}</p> : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
