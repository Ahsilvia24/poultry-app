import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmLitterPageClient } from "@/components/FarmLitterPageClient";

type Params = Promise<{ id: string }>;

export default async function FarmLitterPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmLitterPageClient farmId={id} />;
}
