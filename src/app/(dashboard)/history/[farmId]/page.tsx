import { redirect } from "next/navigation";

type Params = Promise<{ farmId: string }>;

export default async function FarmHistoryFarmRedirect({ params }: { params: Params }) {
  const { farmId } = await params;
  redirect(`/history?farmId=${encodeURIComponent(farmId)}`);
}
