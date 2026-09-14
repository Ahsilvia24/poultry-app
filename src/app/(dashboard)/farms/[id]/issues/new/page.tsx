import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmIssueFormPageClient } from "@/components/FarmIssueFormPageClient";

type Params = Promise<{ id: string }>;

export default async function NewFarmIssuePage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmIssueFormPageClient farmId={id} />;
}
