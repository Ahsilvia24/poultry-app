import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AllVisitsPageClient } from "@/components/AllVisitsPageClient";

export default async function AllVisitsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <AllVisitsPageClient />;
}
