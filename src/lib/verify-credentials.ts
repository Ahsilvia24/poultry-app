import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function signinUnavailableDetail(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.replace(/\s+/g, " ").slice(0, 240);
  }
  return "unknown";
}

export async function verifyEmailPassword(email: string, password: string) {
  try {
    const user = await prisma.user.findUnique({
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
