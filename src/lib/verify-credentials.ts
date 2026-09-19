import bcrypt from "bcryptjs";
import { getNodePrisma } from "@/lib/prisma-node";

export const FARM_DATABASE_LOCKED =
  "The farm database is locked. Open Vercel → Storage → Prisma and raise the plan. Your farms are still saved. Then sign in with email and password.";

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

export async function verifyEmailPassword(email: string, password: string) {
  try {
    const db = await getNodePrisma();
    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  } catch (error) {
    const fail = new Error("SIGNIN_UNAVAILABLE");
    fail.cause = error;
    throw fail;
  }
}
