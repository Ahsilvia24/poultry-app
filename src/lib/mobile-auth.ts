import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return encoder.encode(secret);
}

export type MobileTokenPayload = {
  sub: string;
  email: string;
  name: string;
};

export async function signMobileToken(payload: MobileTokenPayload) {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}

export async function requireMobileUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice(7);
  const payload = await verifyMobileToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  return user;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
