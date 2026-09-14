import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmFeedPageClient } from "@/components/FarmFeedPageClient";

type Params = Promise<{ id: string }>;

export default async function FarmFeedPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmFeedPageClient farmId={id} />;
}
