import { NextRequest } from "next/server";
import { jsonError, requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  return Response.json({
    user: { id: user.id, name: user.name, email: user.email },
  });
}
