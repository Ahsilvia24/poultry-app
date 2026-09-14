import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmFeedFormPageClient } from "@/components/FarmFeedFormPageClient";

type Params = Promise<{ id: string }>;

export default async function NewFarmFeedPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmFeedFormPageClient farmId={id} />;
}
