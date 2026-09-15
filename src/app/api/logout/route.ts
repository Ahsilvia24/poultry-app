import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await signOut({ redirect: false });
  } catch {
    /* Cookie may already be gone. */
  }
  return new Response(null, { status: 204 });
}