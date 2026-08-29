import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export default async function ServiceFarmPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const farm = await prisma.farm.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: { id: true, farmName: true },
  });
  if (!farm) notFound();

  redirect(`/farms/${farm.id}`);
}
