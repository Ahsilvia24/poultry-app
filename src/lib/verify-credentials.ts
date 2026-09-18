import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function verifyEmailPassword(email: string, password: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  } catch {
    throw new Error("SIGNIN_UNAVAILABLE");
  }
}
