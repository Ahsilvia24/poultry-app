import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";

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

  return (
    <div>
      <Link
        href={`/farms/${farm.id}`}
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ←
        </span>
        {farm.farmName}
      </Link>
      <PageHeader title="Service Farm" subtitle={farm.farmName} />
      <Card>
        <p className="font-semibold text-stone-800">Coming soon</p>
        <p className="mt-2 text-sm text-stone-600">
          Service visit forms for this farm will live here. Nothing to fill out yet.
        </p>
      </Card>
    </div>
  );
}
