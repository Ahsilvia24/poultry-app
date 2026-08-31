import { redirect } from "next/navigation";

type Params = Promise<{ farmId: string }>;

export default async function FarmHistoryRedirect({ params }: { params: Params }) {
  const { farmId } = await params;
  redirect(`/reports?type=history&farmId=${encodeURIComponent(farmId)}`);
}
