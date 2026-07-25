import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function getOwnedFarm(farmId: string, userId: string) {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId, deletedAt: null },
  });
  if (!farm) {
    throw new Error("Farm not found or access denied");
  }
  return farm;
}

export async function assertFarmAccess(farmId: string, userId: string) {
  return getOwnedFarm(farmId, userId);
}
