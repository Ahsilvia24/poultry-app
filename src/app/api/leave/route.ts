import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { expireSessionCookies, isSessionCookieName } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost.split(",")[0].trim()}`;
  }
  return url.origin;
}

/**
 * Clear the session cookie, then send the phone to /login.
 * Home Screen workers skip /api/, so this redirect is never swapped
 * for a cached dashboard. /login is the only place that starts a session.
 */
async function leavePage(req: Request) {
  try {
    await signOut({ redirect: false });
  } catch {
    /* Cookie may already be gone. */
  }
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (isSessionCookieName(cookie.name)) jar.delete(cookie.name);
  }
  const res = NextResponse.redirect(new URL("/login", requestOrigin(req)), 303);
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  expireSessionCookies(res);
  return res;
}

export async function GET(req: Request) {
  return leavePage(req);
}

export async function POST(req: Request) {
  return leavePage(req);
}
