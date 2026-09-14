import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmIssueFormPageClient } from "@/components/FarmIssueFormPageClient";

type Params = Promise<{ id: string; issueId: string }>;

export default async function EditFarmIssuePage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, issueId } = await params;
  return <FarmIssueFormPageClient farmId={id} issueId={issueId} />;
}
