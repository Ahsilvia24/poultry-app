import { groupWeeklyMortalityRows, type WeekTotal } from "@/lib/weeklyMortalityLayout";

/** House tiles: Wk1–Wk8, then later rows only after week 9+ has an entry. */
export function WeeklyMortalityList({ weeks }: { weeks: WeekTotal[] }) {
  const rows = groupWeeklyMortalityRows(weeks);

  return (
    <div className="mt-2 space-y-2 [text-size-adjust:100%]">
      {rows.map((row) => (
        <div key={row.map((week) => week.week).join("-")} className="grid grid-cols-4 gap-x-2">
          {row.map((week) => (
            <div key={week.week} className="min-w-0">
              <div className="h-4 text-[11px] font-bold leading-4 text-stone-500">
                Wk{week.week}
              </div>
              <div className="h-6 text-[17px] font-extrabold leading-6 tabular-nums text-stone-900">
                {week.total.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
