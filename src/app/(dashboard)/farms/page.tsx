import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FarmsListTiles } from "@/components/FarmsListTiles";
import { Button, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ status?: string }>;

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

  const tiles = farms.map((farm) => ({
    id: farm.id,
    farmName: farm.farmName,
    growerName: farm.growerName,
    phoneNumber: farm.phoneNumber,
    isActive: farm.isActive,
    houseCount: farm.houses.length,
    flockAges: Array.from(
      new Set(farm.flocks.map((fl) => differenceInCalendarDays(today, fl.placementDate))),
    ).sort((a, b) => a - b),
  }));

  return (
    <div>
      <PageHeader title="Farms" subtitle="Manage grower farms and houses" />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/farms/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Add Farm
        </Link>
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
        <FarmsListTiles farms={tiles} />
      )}
    </div>
  );
}
