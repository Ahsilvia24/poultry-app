import type { NextResponse } from "next/server";

/** Auth.js names the JWT cookie `*session-token`. */
export function cookieNamesHaveSessionToken(names: string[]) {
  return names.some((name) => name.includes("session-token"));
}

export const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function isSessionCookieName(name: string) {
  return name.includes("session-token") || name.includes("callback-url");
}

export function expireSessionCookies(res: NextResponse) {
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure:
        name.startsWith("__Secure-") ||
        name.startsWith("__Host-"),
    });
  }
}

export function cookieHeaderHasSessionToken(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim().split("=")[0]?.includes("session-token"));
}
