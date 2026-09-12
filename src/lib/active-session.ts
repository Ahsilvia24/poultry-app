import { prisma } from "@/lib/prisma";

/** Tokens issued before this column existed stay valid until the next sign-in. */
export function sessionMatches(
  activeSessionId: string | null | undefined,
  presented: string | null | undefined,
) {
  if (!activeSessionId) return true;
  return Boolean(presented && presented === activeSessionId);
}

export async function rotateActiveSession(userId: string) {
  const sessionId = crypto.randomUUID();
  await prisma.user.update({
    where: { id: userId },
    data: { activeSessionId: sessionId, unsyncedAt: null },
  });
  return sessionId;
}

export async function markUnsynced(userId: string, pending: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: { unsyncedAt: pending ? new Date() : null },
  });
}

export async function isActiveSession(
  userId: string,
  presented: string | null | undefined,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSessionId: true },
  });
  if (!user) return false;
  return sessionMatches(user.activeSessionId, presented);
}

export async function clearActiveSession(userId: string, presented: string | null | undefined) {
  if (!presented) return;
  await prisma.user.updateMany({
    where: { id: userId, activeSessionId: presented },
    data: { activeSessionId: null, unsyncedAt: null },
  });
}
