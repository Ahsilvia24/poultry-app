import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isSessionCookieName(name: string) {
  return name.includes("session-token") || name.includes("callback-url");
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
  return new NextResponse(null, { status: 204 });
}
