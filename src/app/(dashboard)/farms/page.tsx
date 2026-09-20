import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmsPageClient } from "@/components/FarmsPageClient";

export default async function FarmsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Farms live in this browser. Do not read Prisma on first paint.
  return <FarmsPageClient initial={[]} />;
}
