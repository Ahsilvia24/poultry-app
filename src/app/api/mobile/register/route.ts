import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { corsPreflight, jsonError, jsonOk, signMobileToken } from "@/lib/mobile-auth";
import { registerSchema } from "@/lib/validations";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("An account with this email already exists", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      settings: { create: {} },
    },
  });

  const token = await signMobileToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });

  return jsonOk({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
