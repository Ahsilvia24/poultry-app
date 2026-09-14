import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmIssuesPageClient } from "@/components/FarmIssuesPageClient";

type Params = Promise<{ id: string }>;

export default async function FarmIssuesPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <FarmIssuesPageClient farmId={id} />;
}
