import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function findUserByLogin(login: string) {
  const key = login.trim();
  if (!key) return null;
  const email = key.toLowerCase();
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) return byEmail;
  const matches = await prisma.user.findMany({
    where: { name: { equals: key, mode: "insensitive" } },
    take: 2,
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** Email or unique service-tech name, then the password. */
export async function verifyLoginPassword(login: string, password: string) {
  const user = await findUserByLogin(login);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function verifyEmailPassword(email: string, password: string) {
  return verifyLoginPassword(email, password);
}
