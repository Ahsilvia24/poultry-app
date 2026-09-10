import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceFarmPicker } from "@/components/serviceForms/ServiceFarmPicker";
import {
  listServiceFormDraftKinds,
  listStoredServiceForms,
} from "@/lib/serviceForms/farmContext";

type Params = Promise<{ id: string }>;

export default async function ServiceFarmPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const userId = session.user.id;
  const [farm, draftKinds, completed] = await Promise.all([
    prisma.farm.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    }),
    listServiceFormDraftKinds(id, userId),
    listStoredServiceForms(id, userId),
  ]);
  if (!farm) notFound();

  return (
    <ServiceFarmPicker farmId={id} draftKinds={draftKinds} completed={completed} />
  );
}
