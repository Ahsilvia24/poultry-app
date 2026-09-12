import { NextRequest } from "next/server";
import { z } from "zod";
import { rotateActiveSession } from "@/lib/active-session";
import { jsonError, signMobileToken } from "@/lib/mobile-auth";
import { replaceLoginStatus } from "@/lib/replace-login";
import { verifyEmailPassword } from "@/lib/verify-credentials";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  confirmReplace: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid email or password", 400);

  const user = await verifyEmailPassword(parsed.data.email, parsed.data.password);
  if (!user) return jsonError("Invalid email or password", 401);

  if (!parsed.data.confirmReplace) {
    const status = replaceLoginStatus({
      activeSessionId: user.activeSessionId,
      unsyncedAt: user.unsyncedAt,
    });
    if (status.otherDevice) {
      return Response.json({ needsConfirm: true, unsynced: status.unsynced });
    }
  }

  const sid = await rotateActiveSession(user.id);
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
