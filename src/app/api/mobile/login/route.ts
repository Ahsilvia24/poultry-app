import { NextRequest } from "next/server";
import { z } from "zod";
import { rotateActiveSession } from "@/lib/active-session";
import { isDeviceId } from "@/lib/device-id";
import { jsonError, signMobileToken } from "@/lib/mobile-auth";
import { replaceLoginStatus } from "@/lib/replace-login";
import { verifyEmailPassword } from "@/lib/verify-credentials";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  confirmReplace: z.boolean().optional(),
  deviceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid email or password", 400);

  let user;
  try {
    user = await verifyEmailPassword(parsed.data.email, parsed.data.password);
  } catch {
    return jsonError("Could not reach sign-in. Try again.", 503);
  }
  if (!user) return jsonError("Invalid email or password", 401);

  if (!parsed.data.confirmReplace) {
    const status = replaceLoginStatus({
      activeSessionId: user.activeSessionId,
      activeDeviceId: user.activeDeviceId,
      unsyncedAt: user.unsyncedAt,
      currentDeviceId: isDeviceId(parsed.data.deviceId) ? parsed.data.deviceId : undefined,
    });
    if (status.otherDevice) {
      return Response.json({
        needsConfirm: true,
        unsynced: status.unsynced,
        knownOtherDevice: status.knownOtherDevice,
      });
    }
  }

  const sid = await rotateActiveSession(
    user.id,
    isDeviceId(parsed.data.deviceId) ? parsed.data.deviceId : undefined,
  );
  const token = await signMobileToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    sid,
  });

  return Response.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
