import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmLitterFormPageClient } from "@/components/FarmLitterFormPageClient";

type Params = Promise<{ id: string }>;

export default async function NewFarmLitterPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmLitterFormPageClient farmId={id} />;
}
