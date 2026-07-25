import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_CATEGORY_LABELS } from "@/lib/utils";
import { Card, Input, PageHeader } from "@/components/ui";

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const userId = session.user.id;

  const houseNumber = Number(q);
  const isHouseNumber = Number.isInteger(houseNumber) && houseNumber > 0;

  const [farms, houses, flocks, issues] = q
    ? await Promise.all([
        prisma.farm.findMany({
          where: {
            userId,
            deletedAt: null,
            OR: [
              { farmName: { contains: q, mode: "insensitive" } },
              { growerName: { contains: q, mode: "insensitive" } },
              { phoneNumber: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 20,
          orderBy: { farmName: "asc" },
        }),
        prisma.house.findMany({
          where: {
            deletedAt: null,
            farm: { userId, deletedAt: null },
            OR: [
              ...(isHouseNumber ? [{ houseNumber }] : []),
              { notes: { contains: q, mode: "insensitive" } },
            ],
          },
          include: { farm: true },
          take: 20,
          orderBy: [{ farm: { farmName: "asc" } }, { houseNumber: "asc" }],
        }),
        prisma.flock.findMany({
          where: {
            deletedAt: null,
            farm: { userId, deletedAt: null },
            OR: [
              { flockNumber: { contains: q, mode: "insensitive" } },
              { flockName: { contains: q, mode: "insensitive" } },
            ],
          },
          include: { farm: true },
          take: 20,
          orderBy: { placementDate: "desc" },
        }),
        prisma.farmIssue.findMany({
          where: {
            farm: { userId, deletedAt: null },
            description: { contains: q, mode: "insensitive" },
          },
          include: { farm: true, house: true },
          take: 20,
          orderBy: { dateReported: "desc" },
        }),
      ])
    : [[], [], [], []];

  return (
    <div>
      <PageHeader title="Search" subtitle="Find farms, houses, flocks, and issues" />

      <Card className="mb-6">
        <form className="flex flex-col gap-3 sm:flex-row">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Farm name, grower, farm #, house #, flock #, issue…"
            className="flex-1"
            autoFocus
          />
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-800"
          >
            Search
          </button>
        </form>
      </Card>

      {!q ? (
        <p className="text-stone-600">Enter a search term to begin.</p>
      ) : (
        <div className="space-y-6">
          <ResultSection title="Farms" empty={farms.length === 0}>
            {farms.map((farm) => (
              <Link key={farm.id} href={`/farms/${farm.id}`} className="block">
                <Card className="transition hover:border-emerald-400">
                  <p className="font-bold">{farm.farmName}</p>
                  <p className="text-sm text-stone-600">{farm.growerName}</p>
                  {farm.phoneNumber ? (
                    <p className="mt-1 text-xs text-stone-500">{farm.phoneNumber}</p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </ResultSection>

          <ResultSection title="Houses" empty={houses.length === 0}>
            {houses.map((house) => (
              <Link key={house.id} href={`/farms/${house.farmId}`} className="block">
                <Card className="transition hover:border-emerald-400">
                  <p className="font-bold">
                    House {house.houseNumber} — {house.farm.farmName}
                  </p>
                  <p className="text-sm text-stone-600">{house.farm.growerName}</p>
                </Card>
              </Link>
            ))}
          </ResultSection>

          <ResultSection title="Flocks" empty={flocks.length === 0}>
            {flocks.map((flock) => (
              <Link key={flock.id} href={`/farms/${flock.farmId}`} className="block">
                <Card className="transition hover:border-emerald-400">
                  <p className="font-bold">
                    Flock {flock.flockNumber} — {flock.farm.farmName}
                  </p>
                  <p className="text-sm text-stone-600">
                    Placed {format(flock.placementDate, "MMM d, yyyy")} · {flock.flockStatus}
                  </p>
                </Card>
              </Link>
            ))}
          </ResultSection>

          <ResultSection title="Issues" empty={issues.length === 0}>
            {issues.map((issue) => (
              <Link key={issue.id} href={`/farms/${issue.farmId}`} className="block">
                <Card className="transition hover:border-emerald-400">
                  <p className="font-bold">{issue.farm.farmName}</p>
                  <p className="text-sm text-stone-700">
                    {ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category}: {issue.description}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {format(issue.dateReported, "MMM d, yyyy")} · {issue.status}
                    {issue.house ? ` · House ${issue.house.houseNumber}` : ""}
                  </p>
                </Card>
              </Link>
            ))}
          </ResultSection>
        </div>
      )}
    </div>
  );
}

function ResultSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {empty ? (
        <p className="text-sm text-stone-500">No matches</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">{children}</div>
      )}
    </section>
  );
}
