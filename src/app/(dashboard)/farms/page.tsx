import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FarmsListTiles } from "@/components/FarmsListTiles";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import { Button, Card, PageHeader } from "@/components/ui";

export default async function FarmsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const today = new Date();

  const [farms, orderRow] = await Promise.all([
    prisma.farm.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        houses: { where: { deletedAt: null }, select: { id: true } },
        flocks: {
          where: { flockStatus: "ACTIVE", deletedAt: null },
          orderBy: { placementDate: "asc" },
          select: { placementDate: true },
        },
      },
      orderBy: { farmName: "asc" },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { farmOrder: true },
    }),
  ]);

  const tiles = sortFarmsByOrder(
    farms.map((farm) => ({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      isActive: farm.isActive,
      houseCount: farm.houses.length,
      flockAges: Array.from(
        new Set(farm.flocks.map((fl) => differenceInCalendarDays(today, fl.placementDate))),
      ).sort((a, b) => a - b),
    })),
    parseFarmOrder(orderRow?.farmOrder),
  );

  return (
    <div>
      <PageHeader
        title="Farms"
        actions={
          <Link href="/farms/new">
            <Button className="min-h-10 px-4 text-sm">Add Farm</Button>
          </Link>
        }
      />

      {farms.length === 0 ? (
        <Card>
          <p className="text-stone-600">No farms found.</p>
          <Link href="/farms/new" className="mt-3 inline-block">
            <Button>Add your first farm</Button>
          </Link>
        </Card>
      ) : (
        <FarmsListTiles farms={tiles} />
      )}
    </div>
  );
}
