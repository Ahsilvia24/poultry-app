import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmGeneratorsPageClient } from "@/components/FarmGeneratorsPageClient";

type Params = Promise<{ id: string }>;

export default async function FarmGeneratorsPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmGeneratorsPageClient farmId={id} />;
}
