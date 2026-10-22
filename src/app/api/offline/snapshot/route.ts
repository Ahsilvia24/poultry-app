import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadHostedReplica,
  saveHostedReplica,
  websiteHasPhoneFarms,
} from "@/lib/offline/hostedReplica";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import type { OfflineSnapshot } from "@/lib/offline/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function sessionEmail() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const email = normalizeOwnerEmail(session.user.email ?? "");
  if (!email.includes("@")) return null;
  return { session, email };
}

/** Hosted replica only. Never build a Prisma snapshot for the phone. */
export async function GET() {
  const signed = await sessionEmail();
  if (!signed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const hosted = await loadHostedReplica(signed.email);
  if (!hosted) {
    return NextResponse.json(
      { ok: false, error: "No website farms for this email." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, snapshot: hosted });
}

/** Store this phone’s replica on the website. Never write that copy back onto the phone. */
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
