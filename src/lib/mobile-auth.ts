import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { isActiveSession } from "@/lib/active-session";
import { applyHostedEnv } from "@/lib/hosted-env";

const encoder = new TextEncoder();

function getSecret() {
  applyHostedEnv();
  const secret = process.env.AUTH_SECRET || process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return encoder.encode(secret);
}

export type MobileTokenPayload = {
  sub: string;
  email: string;
  name: string;
  sid?: string;
};

export async function signMobileToken(payload: MobileTokenPayload) {
  return new SignJWT({ email: payload.email, name: payload.name, sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("400d")
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
      sid: typeof payload.sid === "string" ? payload.sid : undefined,
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
  if (!(await isActiveSession(payload.sub, payload.sid))) return null;
  return { id: payload.sub, email: payload.email, name: payload.name };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
