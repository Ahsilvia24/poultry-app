import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markUnsynced } from "@/lib/active-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { pending?: unknown } | null;
  await markUnsynced(session.user.id, Boolean(body?.pending));
  return NextResponse.json({ ok: true });
}
