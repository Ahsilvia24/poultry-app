import { isDeviceId } from "@/lib/device-id";
import { prisma } from "@/lib/prisma";

/** Tokens issued before this column existed stay valid until the next sign-in. */
export function sessionMatches(
  activeSessionId: string | null | undefined,
  presented: string | null | undefined,
) {
  if (!activeSessionId) return true;
  return Boolean(presented && presented === activeSessionId);
}

export type SessionLookup = { ok: true; activeSessionId: string | null } | { ok: false };

/** DB blips must not look like a sign-out. Only a proven mismatch kicks the phone. */
export function decideActiveSession(
  lookup: SessionLookup,
  presented: string | null | undefined,
) {
  if (!lookup.ok) return true;
  return sessionMatches(lookup.activeSessionId, presented);
}

/** Same phone signing in again keeps the current session so this app stays logged in. */
export function reuseExistingSessionId(
  activeSessionId: string | null | undefined,
  activeDeviceId: string | null | undefined,
  deviceId: string | null | undefined,
) {
  if (
    typeof activeSessionId === "string" &&
    activeSessionId.length > 0 &&
    isDeviceId(deviceId) &&
    activeDeviceId === deviceId
  ) {
    return activeSessionId;
  }
  return null;
}

export async function rotateActiveSession(
  userId: string,
  deviceId?: string | null,
  db: Pick<typeof prisma, "user"> = prisma,
) {
  if (isDeviceId(deviceId)) {
    const current = await db.user.findUnique({
      where: { id: userId },
      select: { activeSessionId: true, activeDeviceId: true },
    });
    const reuse = reuseExistingSessionId(
      current?.activeSessionId,
      current?.activeDeviceId,
      deviceId,
    );
    if (reuse) return reuse;
  }
  const sessionId = crypto.randomUUID();
  await db.user.update({
    where: { id: userId },
    data: {
      activeSessionId: sessionId,
      unsyncedAt: null,
      ...(isDeviceId(deviceId) ? { activeDeviceId: deviceId } : {}),
    },
  });
  return sessionId;
}

export async function bindActiveDevice(
  userId: string,
  presented: string | null | undefined,
  deviceId: string,
) {
  if (!presented || !isDeviceId(deviceId)) return;
  await prisma.user.updateMany({
    where: { id: userId, activeSessionId: presented },
    data: { activeDeviceId: deviceId },
  });
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
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeSessionId: true },
    });
    // Phone-owned logins use a local user id. Missing Prisma row is not a sign-out.
    if (!user) return true;
    return decideActiveSession({ ok: true, activeSessionId: user.activeSessionId }, presented);
  } catch {
    return decideActiveSession({ ok: false }, presented);
  }
}

export async function clearActiveSession(userId: string, presented: string | null | undefined) {
  if (!presented) return;
  await prisma.user.updateMany({
    where: { id: userId, activeSessionId: presented },
    data: { activeSessionId: null, activeDeviceId: null, unsyncedAt: null },
  });
}
