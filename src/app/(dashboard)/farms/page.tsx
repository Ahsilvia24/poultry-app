import { redirect } from "next/navigation";
import { appToday } from "@/lib/app-calendar";
import { daysSincePlacement } from "@/lib/mortality/calculations";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FarmsPageClient } from "@/components/FarmsPageClient";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";

export default async function FarmsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const timeZone = await getUserTimeZone(session.user.id);
  const today = appToday(undefined, timeZone);

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
        new Set(farm.flocks.map((fl) => daysSincePlacement(fl.placementDate, today, timeZone))),
      ).sort((a, b) => a - b),
    })),
    parseFarmOrder(orderRow?.farmOrder),
  );

  return <FarmsPageClient initial={tiles} />;
}
