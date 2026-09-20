import { NextResponse } from "next/server";
import { isOwnerEmail, normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import {
  createLocalWebSession,
  putSessionOnResponse,
  requestUsesSecureCookies,
} from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: unknown; userId?: unknown; name?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; userId?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }
  const email = normalizeOwnerEmail(String(body.email ?? ""));
  const userId = String(body.userId ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!isOwnerEmail(email) || !userId) {
    return NextResponse.json({ error: "Use the email for this account." }, { status: 400 });
  }
  const created = await createLocalWebSession(
    { id: userId, email, name: name || email.split("@")[0] },
    requestUsesSecureCookies(req),
  );
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 401 });
  }
  return putSessionOnResponse(NextResponse.json({ ok: true }), created.cookie);
}
