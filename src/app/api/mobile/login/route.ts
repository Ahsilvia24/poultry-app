import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corsPreflight, jsonError, jsonOk, signMobileToken } from "@/lib/mobile-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid email or password", 400);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user) return jsonError("Invalid email or password", 401);

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return jsonError("Invalid email or password", 401);

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
