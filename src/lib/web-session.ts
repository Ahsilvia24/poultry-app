import { encode } from "@auth/core/jwt";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth.config";
import { applyHostedEnv } from "@/lib/hosted-env";
import {
  attachSessionCookie,
  type IssuedSessionCookie,
} from "@/lib/session-cookie";
import { verifyEmailPassword } from "@/lib/verify-credentials";

applyHostedEnv();

const SESSION_FAIL = "Could not start this sign-in. Try again.";

export function requestUsesSecureCookies(req: Request) {
  const forwarded = req.headers.get("x-forwarded-proto");
  const proto = (forwarded ?? new URL(req.url).protocol.replace(/:$/, ""))
    .split(",")[0]
    .trim();
  return proto === "https";
}

export function sessionCookieName(secure: boolean) {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function issueSessionCookie(
  user: { id: string; email: string; name?: string | null },
  sessionId: string,
  secure: boolean,
): Promise<IssuedSessionCookie> {
  applyHostedEnv();
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const name = sessionCookieName(secure);
  const value = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      sid: sessionId,
    },
    secret,
    salt: name,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return {
    name,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: SESSION_MAX_AGE_SECONDS,
      expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    },
  };
}

export async function createLocalWebSession(
  user: { id: string; email: string; name?: string | null },
  secure: boolean,
): Promise<{ cookie: IssuedSessionCookie } | { error: string }> {
  try {
    return { cookie: await issueSessionCookie(user, crypto.randomUUID(), secure) };
  } catch {
    return { error: SESSION_FAIL };
  }
}

export async function createWebSession(
  user: { id: string; email: string; name?: string | null },
  _deviceId: string | undefined,
  secure: boolean,
): Promise<{ cookie: IssuedSessionCookie } | { error: string }> {
  return createLocalWebSession(user, secure);
}

export function putSessionOnResponse(res: NextResponse, cookie: IssuedSessionCookie) {
  return attachSessionCookie(res, cookie);
}

/**
 * Server Actions can write the session through `cookies()`.
 * Route Handlers must call `putSessionOnResponse` on the JSON/redirect they return.
 */
export async function establishWebSession(
  email: string,
  password: string,
  deviceId?: string,
  secure = Boolean(process.env.AUTH_URL?.startsWith("https://")),
): Promise<{ error?: string }> {
  const user = await verifyEmailPassword(email, password);
  if (!user) return { error: "Invalid email or password" };
  const created = await createWebSession(user, deviceId, secure);
  if ("error" in created) return created;
  try {
    const jar = await cookies();
    jar.set(created.cookie.name, created.cookie.value, created.cookie.options);
    return {};
  } catch {
    return { error: SESSION_FAIL };
  }
}
