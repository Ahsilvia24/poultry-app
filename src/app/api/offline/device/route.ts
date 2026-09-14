import { NextResponse } from "next/server";
import { bindActiveDevice } from "@/lib/active-session";
import { auth } from "@/lib/auth";
import { isDeviceId } from "@/lib/device-id";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { deviceId?: unknown } | null;
  if (!isDeviceId(body?.deviceId)) {
    return NextResponse.json({ ok: false, error: "Invalid device" }, { status: 400 });
  }
  await bindActiveDevice(session.user.id, session.user.sessionId, body.deviceId);
  return NextResponse.json({ ok: true });
}
