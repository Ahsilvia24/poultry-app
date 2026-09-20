export const FARM_DATABASE_LOCKED =
  "The farm database is locked. Open Vercel → Storage → Prisma and raise the plan. Your farms are still saved. Then sign in with your email and password.";

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const cause = error.cause ? ` ${errorText(error.cause)}` : "";
    return `${error.name}: ${error.message}${cause}`;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

export function isFarmDatabaseLocked(error: unknown) {
  return /planLimitReached|account has restrictions/i.test(errorText(error));
}

export function signinUnavailableMessage(error: unknown) {
  return isFarmDatabaseLocked(error)
    ? FARM_DATABASE_LOCKED
    : "Could not reach sign-in. Try again.";
}

export function signinUnavailableDetail(error: unknown) {
  const text = errorText(error).replace(/\s+/g, " ").trim();
  return (text || "unknown").slice(0, 240);
}

/** Passwords live on the phone. There is no hosted user table to check. */
export async function verifyEmailPassword(
  _email: string,
  _password: string,
): Promise<{
  id: string;
  email: string;
  name: string | null;
  activeSessionId?: string | null;
  activeDeviceId?: string | null;
  unsyncedAt?: Date | string | null;
} | null> {
  return null;
}
