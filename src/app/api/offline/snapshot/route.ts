import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadHostedReplica,
  saveHostedReplica,
  websiteHasPhoneFarms,
} from "@/lib/offline/hostedReplica";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { lastReplicaStoreError } from "@/lib/offline/replicaStore";
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

export async function GET() {
  const signed = await sessionEmail();
  if (!signed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const hosted = await loadHostedReplica(signed.email);
  if (hosted) {
    return NextResponse.json({ ok: true, snapshot: hosted });
  }
  return NextResponse.json(
    { ok: false, error: "No website farms for this email yet. Sync from the phone." },
    { status: 404 },
  );
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
    return NextResponse.json(
      {
        ok: false,
        error: lastReplicaStoreError() || "Could not save farms to the website.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, snapshot: readBack });
}
