import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";

export default async function NewLfoFarmSelectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const farms = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null, isActive: true },
    include: {
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        take: 1,
        select: { flockNumber: true },
      },
      houses: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
    orderBy: { farmName: "asc" },
  });

  const eligible = farms.filter((f) => f.flocks.length > 0 && f.houses.length > 0);

  return (
    <div>
      <Link
        href="/lfo"
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ←
        </span>
        LFOs
      </Link>
      <PageHeader title="New LFO" subtitle="Select the farm for this last feed order" />

      {eligible.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No farms with an active flock and houses. Add a flock on a farm first.
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {eligible.map((farm) => (
            <li key={farm.id}>
              <Link
                href={`/lfo/new/${farm.id}`}
                className="flex items-baseline justify-between gap-2 px-4 py-3 hover:bg-stone-50"
              >
                <div>
                  <p className="font-semibold text-stone-900">{farm.farmName}</p>
                  <p className="text-sm text-stone-600">
                    Flock {farm.flocks[0]!.flockNumber} · {farm.houses.length} houses
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-800">Select →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
