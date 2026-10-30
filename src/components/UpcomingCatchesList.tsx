"use client";

import {
  catchRowHouseNumber,
  formatCatchDateLabel,
  formatCatchHouseLabel,
} from "@/lib/catchHouses";
import { compactCatchTimeLabel } from "@/lib/time-slots";
import { OneDotName } from "@/components/OneDotName";
import { ReplicaLink } from "@/components/ReplicaLink";
import { ScrollableFarmList } from "@/components/ScrollableFarmList";

export type UpcomingCatchItem = {
  farmId?: string;
  farmName: string;
  date: string;
  flockNumber: string;
  catchTime?: string | null;
  houseNumber?: number | null;
  houseNumbers?: number[];
};

function catchFarmHref(
  farmId: string | undefined,
  farmName: string,
  farms: { id: string; farmName: string }[] | undefined,
) {
  if (farmId) return `/farms/${farmId}`;
  const match = farms?.find((farm) => farm.farmName === farmName);
  return match ? `/farms/${match.id}` : null;
}

export function UpcomingCatchesList({
  items,
  timeZone,
  farms,
  capped = true,
  emptyLabel = "None",
}: {
  items: UpcomingCatchItem[];
  timeZone: string;
  farms?: { id: string; farmName: string }[];
  capped?: boolean;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-[15px] text-stone-500">{emptyLabel}</p>;
  }

  const list = (
    <ul className="space-y-2.5 text-[15px]">
      {items.map((c) => {
        const href = catchFarmHref(c.farmId, c.farmName, farms);
        const houseNumber = catchRowHouseNumber(c);
        const houseLabel = formatCatchHouseLabel(houseNumber);
        const name = (
          <>
            <OneDotName text={c.farmName} />
            {houseLabel ? (
              <span className="shrink-0 font-normal text-stone-500">{houseLabel}</span>
            ) : null}
          </>
        );
        return (
          <li
            key={`${c.farmId || c.farmName}-${houseNumber ?? ""}-${c.date}-${c.flockNumber}`}
            className="flex min-h-[22px] items-baseline gap-2"
          >
            {href ? (
              <ReplicaLink
                href={href}
                prefetch
                className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden font-semibold text-stone-900 hover:underline"
              >
                {name}
              </ReplicaLink>
            ) : (
              <span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden font-semibold text-stone-900">
                {name}
              </span>
            )}
            <span className="ml-auto flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-stone-600">
              <span>{formatCatchDateLabel(c.date, timeZone)}</span>
              {c.catchTime ? <span>{compactCatchTimeLabel(c.catchTime)}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (!capped) return <div className="mt-2">{list}</div>;
  return <ScrollableFarmList className="mt-2 pr-2">{list}</ScrollableFarmList>;
}
