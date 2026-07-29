import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteFarmButton, DeactivateFarmButton, ReactivateFarmButton } from "@/components/FarmOpsForms";
import { Button, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ status?: string }>;

function dialHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${phone}`;
}

export default async function FarmsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active";
  const today = new Date();

  const farms = await prisma.farm.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    },
    include: {
      houses: { where: { deletedAt: null }, select: { id: true } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "asc" },
        select: { placementDate: true },
      },
    },
    orderBy: { farmName: "asc" },
  });

  const filters = [
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "all", label: "All" },
  ] as const;

  return (
    <div>
      <PageHeader title="Farms" subtitle="Manage grower farms and houses" />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "active" ? "/farms" : `/farms?status=${f.key}`}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold",
              status === f.key ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-800",
            )}
          >
            {f.label}
          </Link>
        ))}
        <Link
          href="/farms/new"
          className="rounded-lg bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-800"
        >
          Add Farm
        </Link>
      </div>

      {farms.length === 0 ? (
        <Card>
          <p className="text-stone-600">No farms found for this filter.</p>
          <Link href="/farms/new" className="mt-3 inline-block">
            <Button>Add your first farm</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {farms.map((farm) => {
            const houseCount = farm.houses.length;
            const flockAges = Array.from(
              new Set(
                farm.flocks.map((fl) => differenceInCalendarDays(today, fl.placementDate)),
              ),
            ).sort((a, b) => a - b);

            return (
              <Card key={farm.id} className="p-3 transition hover:border-emerald-400">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/farms/${farm.id}`} className="block">
                      <p className="text-base font-bold leading-snug text-stone-900">
                        {farm.farmName}
                        <span className="font-semibold text-stone-500"> ({houseCount})</span>
                        {flockAges.length > 0 ? (
                          <span className="font-semibold text-stone-500">
                            {" "}
                            · {flockAges.map((a) => `${a}d`).join(" · ")}
                          </span>
                        ) : null}
                      </p>
                    </Link>
                    {farm.growerName || farm.phoneNumber ? (
                      <p className="mt-0.5 text-sm leading-snug">
                        {farm.growerName ? (
                          <Link
                            href={`/farms/${farm.id}`}
                            className="text-stone-600 hover:text-stone-800"
                          >
                            {farm.growerName}
                          </Link>
                        ) : null}
                        {farm.growerName && farm.phoneNumber ? (
                          <span className="text-stone-400"> · </span>
                        ) : null}
                        {farm.phoneNumber ? (
                          <a
                            href={dialHref(farm.phoneNumber)}
                            className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                          >
                            {farm.phoneNumber}
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="ml-1 flex shrink-0 items-center gap-1">
                    {farm.isActive ? (
                      <DeactivateFarmButton farmId={farm.id} appearance="badge" />
                    ) : (
                      <ReactivateFarmButton farmId={farm.id} appearance="badge" />
                    )}
                    {!farm.isActive ? (
                      <DeleteFarmButton farmId={farm.id} appearance="icon" />
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
