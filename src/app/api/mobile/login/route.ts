import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rotateActiveSession } from "@/lib/active-session";
import { jsonError, signMobileToken } from "@/lib/mobile-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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

  const sid = await rotateActiveSession(user.id);
  const token = await signMobileToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    sid,
  });

  return Response.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
