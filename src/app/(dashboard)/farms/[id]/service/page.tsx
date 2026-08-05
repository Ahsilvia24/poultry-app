import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitleBackLink } from "@/components/PageTitleBackLink";
import { Card, PAGE_TITLE_CLASS } from "@/components/ui";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const FORMS = [
  {
    key: "report",
    title: "Service Report",
    subtitle: "Routine service checklist → visit + PDF",
    href: "report",
  },
  {
    key: "placement",
    title: "Placement",
    subtitle: "Placement day checklist → visit + PDF",
    href: "placement",
  },
  {
    key: "prebrood",
    title: "Prebrood (48–72 hr)",
    subtitle: "Prebrood checklist → visit + PDF",
    href: "prebrood",
  },
] as const;

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
        <h1 className={cn(PAGE_TITLE_CLASS, "min-w-0 truncate text-right")}>
          Service
        </h1>
      </div>
      <p className="mb-4 text-sm text-stone-600">Choose a checklist</p>
      <div className="space-y-2.5">
        {FORMS.map((form) => (
          <Link
            key={form.key}
            href={`/farms/${farm.id}/service/${form.href}`}
            className="block transition hover:opacity-90"
          >
            <Card>
              <p className="text-lg font-extrabold text-stone-900">{form.title}</p>
              <p className="mt-1 text-sm text-stone-500">{form.subtitle}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
