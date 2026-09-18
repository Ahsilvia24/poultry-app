import type { NextResponse } from "next/server";

/** Cookie Auth.js will decode as this phone's session. */
export type IssuedSessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
    maxAge: number;
    expires: Date;
  };
};

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

function expireCookieOptions(name: string) {
  return {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: name.startsWith("__Secure-") || name.startsWith("__Host-"),
  };
}

export function expireSessionCookies(res: NextResponse) {
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, "", expireCookieOptions(name));
  }
}

/** Put the session on this response. Drop leftover empty Auth.js cookies first. */
export function attachSessionCookie(res: NextResponse, cookie: IssuedSessionCookie) {
  for (const name of SESSION_COOKIE_NAMES) {
    if (name === cookie.name) continue;
    res.cookies.set(name, "", expireCookieOptions(name));
  }
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}

export function cookieHeaderHasSessionToken(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim().split("=")[0]?.includes("session-token"));
}
