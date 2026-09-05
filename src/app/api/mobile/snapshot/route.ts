import { NextRequest } from "next/server";
import { corsPreflight, jsonError, jsonOk, requireMobileUser } from "@/lib/mobile-auth";
import { applyUserSnapshot, parseSnapshotBody, serializeUserSnapshot } from "@/lib/mobile-snapshot";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const snapshot = await serializeUserSnapshot(user.id);
  return jsonOk(snapshot);
}

export async function PUT(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const tables = parseSnapshotBody(body);
  if (!tables) return jsonError("Invalid snapshot", 400);

  try {
    const result = await applyUserSnapshot(user.id, tables);
    return jsonOk({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save snapshot";
    const status = message.includes("another technician") ? 409 : 400;
    return jsonError(message, status);
  }
}
