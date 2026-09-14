import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmVisitFormPageClient } from "@/components/FarmVisitFormPageClient";

type Params = Promise<{ id: string; visitId: string }>;

export default async function EditFarmVisitPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, visitId } = await params;
  return <FarmVisitFormPageClient farmId={id} visitId={visitId} />;
}
