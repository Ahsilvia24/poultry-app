import { NextRequest } from "next/server";
import { corsPreflight, jsonError, jsonOk, requireMobileUser } from "@/lib/mobile-auth";

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);
  return jsonOk({
    user: { id: user.id, name: user.name, email: user.email },
  });
}
