import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmVisitsPageClient } from "@/components/FarmVisitsPageClient";

type Params = Promise<{ id: string }>;

export default async function FarmVisitsPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmVisitsPageClient farmId={id} />;
}
