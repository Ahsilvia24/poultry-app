import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteFarmButton } from "@/components/FarmOpsForms";
import { Button, Card, PageHeader } from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";

type SearchParams = Promise<{ status?: string }>;

export default async function FarmsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const status = params.status === "inactive" || params.status === "all" ? params.status : "active";

  const farms = await prisma.farm.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    },
    include: {
      houses: { where: { deletedAt: null } },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        take: 1,
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
      <PageHeader
        title="Farms"
        subtitle="Manage grower farms and houses"
        actions={
          <Link href="/farms/new">
            <Button>New farm</Button>
          </Link>
        }
      />

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
      </div>

      {farms.length === 0 ? (
        <Card>
          <p className="text-stone-600">No farms found for this filter.</p>
          <Link href="/farms/new" className="mt-3 inline-block">
            <Button>Add your first farm</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {farms.map((farm) => {
            const active = farm.flocks[0];
            return (
              <Card key={farm.id} className="relative transition hover:border-emerald-400">
                <Link href={`/farms/${farm.id}`} className="block pb-2 pr-12">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-stone-900">
                        {farm.farmName}
                        {active ? (
                          <span className="font-semibold text-stone-500">
                            {" "}
                            · {differenceInCalendarDays(new Date(), active.placementDate)}d
                          </span>
                        ) : null}
                      </p>
                      {farm.growerName ? (
                        <p className="text-sm text-stone-600">{farm.growerName}</p>
                      ) : null}
                      {farm.phoneNumber ? (
                        <p className="mt-1 text-xs text-stone-500">{farm.phoneNumber}</p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2.5 py-1 text-sm font-bold",
                        farm.isActive
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-stone-100 text-stone-700",
                      )}
                    >
                      {farm.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-stone-500">Houses</p>
                      <p className="font-semibold">{farm.houses.length}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Placement date</p>
                      <p className="font-semibold">
                        {active
                          ? format(active.placementDate, "EEE, MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Birds placed</p>
                      <p className="font-semibold">
                        {active ? formatNumber(active.initialBirdCount) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-stone-500">Catch date</p>
                      <p className="font-semibold">
                        {active?.projectedCatchDate
                          ? format(active.projectedCatchDate, "EEE, MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="absolute bottom-3 right-3">
                  <DeleteFarmButton farmId={farm.id} appearance="icon" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
