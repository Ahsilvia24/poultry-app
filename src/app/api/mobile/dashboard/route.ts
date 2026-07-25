import { NextRequest } from "next/server";
import { jsonError, requireMobileUser } from "@/lib/mobile-auth";
import { getDashboardData } from "@/lib/dashboard";

export async function GET(req: NextRequest) {
  const user = await requireMobileUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const data = await getDashboardData(user.id);
  return Response.json(data);
}
