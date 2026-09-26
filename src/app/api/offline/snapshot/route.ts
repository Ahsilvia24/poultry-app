import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildOfflineSnapshot, resolveHostedUserId } from "@/lib/offline/buildSnapshot";
import {
  loadHostedReplica,
  saveHostedReplica,
  websiteHasPhoneFarms,
} from "@/lib/offline/hostedReplica";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { ensureWeightProjectionVisitType } from "@/lib/visits/ensureVisitType";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function sessionEmail() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const email = normalizeOwnerEmail(session.user.email ?? "");
  if (!email.includes("@")) return null;
  return { session, email };
}

export async function GET() {
  const signed = await sessionEmail();
  if (!signed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const hosted = await loadHostedReplica(signed.email);
  if (hosted) {
    return NextResponse.json({ ok: true, snapshot: hosted });
  }
  try {
    const userId = await resolveHostedUserId({
      id: signed.session.user?.id,
      email: signed.email,
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

/** Keep the phone replica on the website so Safari can seed from this email. */
export async function POST(req: Request) {
  const signed = await sessionEmail();
  if (!signed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { snapshot?: OfflineSnapshot } | null;
  const incoming = body?.snapshot;
  if (!incoming || !snapshotHasFarmGraph(incoming)) {
    return NextResponse.json({ ok: false, error: "No farms to save." }, { status: 400 });
  }
  const stored = await saveHostedReplica(signed.email, incoming);
  const readBack = stored ? await loadHostedReplica(signed.email) : null;
  if (!readBack || !websiteHasPhoneFarms(incoming, readBack)) {
    return NextResponse.json({ ok: false, error: "Could not save farms to the website." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, snapshot: readBack });
}
