import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { expireSessionCookies, isSessionCookieName } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

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
