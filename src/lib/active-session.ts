import { isDeviceId } from "@/lib/device-id";

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
  _userId: string,
  deviceId?: string | null,
) {
  const reuse = reuseExistingSessionId(null, null, deviceId);
  if (reuse) return reuse;
  return crypto.randomUUID();
}

export async function bindActiveDevice(
  _userId: string,
  _presented: string | null | undefined,
  _deviceId: string,
) {}

export async function markUnsynced(_userId: string, _pending: boolean) {}

export async function isActiveSession(
  _userId: string,
  presented: string | null | undefined,
) {
  return decideActiveSession({ ok: false }, presented);
}

export async function clearActiveSession(
  _userId: string,
  _presented: string | null | undefined,
) {}
