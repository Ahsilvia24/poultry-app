import { NextRequest } from "next/server";
import { jsonError, requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const status = req.nextUrl.searchParams.get("status") ?? "active";
  const farms = await prisma.farm.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    },
    include: {
      houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        take: 1,
        include: {
          houseFlocks: {
            include: { house: true },
          },
        },
      },
    },
    orderBy: { farmName: "asc" },
  });

  return Response.json({
    farms: farms.map((f) => ({
      id: f.id,
      farmName: f.farmName,
      growerName: f.growerName,
      phoneNumber: f.phoneNumber,
      numberOfHouses: f.houses.length,
      activeFlock: f.flocks[0]
        ? {
            id: f.flocks[0].id,
            flockNumber: f.flocks[0].flockNumber,
            placementDate: f.flocks[0].placementDate,
            houseCount: f.flocks[0].houseFlocks.length,
          }
        : null,
    })),
  });
}
