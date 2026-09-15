import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { expireSessionCookies, isSessionCookieName } from "@/lib/session-cookie";

export const dynamic = "force-dynamic";

/**
 * Sign out and return the static leave page as HTML.
 * Home Screen workers skip /api/, so even an old cached worker cannot
 * replace this with the dashboard.
 */
async function leavePage() {
  try {
    await signOut({ redirect: false });
  } catch {
    /* Cookie may already be gone. */
  }
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (isSessionCookieName(cookie.name)) jar.delete(cookie.name);
  }
  let html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>PoultryTech</title></head><body><p>Signed out of this phone.</p></body></html>";
  try {
    html = await readFile(join(process.cwd(), "public/signed-out.html"), "utf8");
  } catch {
    /* Function still leaves the session; phone shows the short fallback. */
  }
  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
  expireSessionCookies(res);
  return res;
}

export async function GET() {
  return leavePage();
}

export async function POST() {
  return leavePage();
}
