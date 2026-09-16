import { FarmVisitFormView } from "@/components/FarmVisitFormView";

type SearchParams = Promise<{ from?: string; place?: string }>;

export default async function OtherVisitNewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <FarmVisitFormView
      farmId=""
      placeName={params.place?.trim() ?? ""}
      fromAllVisits
    />
  );
}
