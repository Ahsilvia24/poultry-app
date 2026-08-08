import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettlementExampleUpload } from "@/components/SettlementExampleUpload";
import { SettlementForm } from "@/components/SettlementForm";
import { PageHeader } from "@/components/ui";
import { listSettlementExamples } from "@/lib/settlement-examples";
import { redirect } from "next/navigation";

type SearchParams = Promise<{ farmId?: string }>;

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  const farms = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { farmName: "asc" },
    include: {
      flocks: {
        where: { deletedAt: null },
        orderBy: { placementDate: "desc" },
        select: {
          id: true,
          flockNumber: true,
          flockStatus: true,
          birdType: true,
          growthRateLbsPerDay: true,
          settlementMarketAgeInDays: true,
          settlementWeightLbs: true,
          settlementFeedConversion: true,
          settlementAdjustedFeedConversion: true,
          settlementGoodPoundsSold: true,
          settlementNo: true,
        },
      },
    },
  });

  const farmOptions = farms.map((f) => ({
    id: f.id,
    farmName: f.farmName,
    flocks: f.flocks.map((fl) => ({
      id: fl.id,
      flockNumber: fl.flockNumber,
      status: fl.flockStatus,
      birdType: fl.birdType,
      growthRateLbsPerDay: fl.growthRateLbsPerDay,
      settlementMarketAgeInDays: fl.settlementMarketAgeInDays,
      settlementWeightLbs: fl.settlementWeightLbs,
      settlementFeedConversion: fl.settlementFeedConversion,
      settlementAdjustedFeedConversion: fl.settlementAdjustedFeedConversion,
      settlementGoodPoundsSold: fl.settlementGoodPoundsSold,
      settlementNo: fl.settlementNo,
    })),
  }));

  const lockedFarmId =
    params.farmId && farmOptions.some((f) => f.id === params.farmId)
      ? params.farmId
      : undefined;

  const examples = await listSettlementExamples();

  return (
    <div>
      <PageHeader
        title="Settlement"
        subtitle="Enter settlement sheet info by farm and flock"
      />
      <SettlementExampleUpload examples={examples} />
      <SettlementForm farms={farmOptions} lockedFarmId={lockedFarmId} />
    </div>
  );
}
