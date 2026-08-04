import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitleBackLink } from "@/components/PageTitleBackLink";
import { Card, PAGE_TITLE_CLASS } from "@/components/ui";
import { cn } from "@/lib/utils";

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
      <div className="mb-6 flex items-center justify-between gap-3">
        <PageTitleBackLink href={`/farms/${farm.id}`} label={farm.farmName} />
        <h1 className={cn(PAGE_TITLE_CLASS, "min-w-0 truncate text-right")}>Service Farm</h1>
      </div>
      <Card>
        <p className="font-semibold text-stone-800">Available on mobile</p>
        <p className="mt-2 text-sm text-stone-600">
          Service Report, Placement, and Prebrood checklists are in the Expo app.
          Completing a form logs a visit and can share a PDF. Web forms will follow.
        </p>
      </Card>
    </div>
  );
}
