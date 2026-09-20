import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildOfflineSnapshot, resolveHostedUserId } from "@/lib/offline/buildSnapshot";
import { ensureWeightProjectionVisitType } from "@/lib/visits/ensureVisitType";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const userId = await resolveHostedUserId({
      id: session.user.id,
      email: session.user.email,
    });
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "No website farms for this email." },
        { status: 404 },
      );
    }
    await ensureWeightProjectionVisitType();
    const snapshot = await buildOfflineSnapshot(userId);
    return NextResponse.json({ ok: true, snapshot });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save farms to this phone." }, { status: 500 });
  }
}
