import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function isSessionCookieName(name: string) {
  return name.includes("session-token") || name.includes("callback-url");
}

function expireSessionCookies(res: NextResponse) {
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }
}

export async function POST() {
  try {
    await signOut({ redirect: false });
  } catch {
    /* Cookie may already be gone. */
  }
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (isSessionCookieName(cookie.name)) jar.delete(cookie.name);
  }
  const res = new NextResponse(null, { status: 204 });
  expireSessionCookies(res);
  return res;
}
