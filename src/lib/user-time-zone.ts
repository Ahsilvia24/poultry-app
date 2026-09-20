import { prisma } from "@/lib/prisma";
import { resolveAppTimeZone } from "@/lib/app-time-zones";

export async function getUserTimeZone(userId: string): Promise<string> {
  try {
    const row = await prisma.userSettings.findUnique({
      where: { userId },
      select: { appTimeZone: true },
    });
    return resolveAppTimeZone(row?.appTimeZone);
  } catch {
    return resolveAppTimeZone(undefined);
  }
}
