import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmDetailClient } from "@/components/FarmDetailClient";

type Params = Promise<{ id: string }>;

export default async function FarmDetailPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmDetailClient farmId={id} />;
}
