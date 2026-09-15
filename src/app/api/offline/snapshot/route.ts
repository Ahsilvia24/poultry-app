import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildOfflineSnapshot } from "@/lib/offline/buildSnapshot";
import { ensureWeightProjectionVisitType } from "@/lib/visits/ensureVisitType";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureWeightProjectionVisitType();
    const snapshot = await buildOfflineSnapshot(session.user.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save farms to this phone." }, { status: 500 });
  }
}
