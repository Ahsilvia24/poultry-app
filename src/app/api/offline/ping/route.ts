import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureWeightProjectionVisitType } from "@/lib/visits/ensureVisitType";

export const dynamic = "force-dynamic";

/** Cheap website check for Sync data. 204 means this phone can reach the account. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  await ensureWeightProjectionVisitType();
  return new NextResponse(null, { status: 204 });
}
