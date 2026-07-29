type WeekTotal = { week: number; total: number };

/** Weeks 1–4 / 5–8 / 9–12 as fixed 4-column rows (empty slots keep columns aligned). */
function groupByFourWeekRows(weeks: WeekTotal[]): Array<Array<WeekTotal | null>> {
  if (weeks.length === 0) return [];
  const byWeek = new Map(
    weeks
      .filter((w) => w.week >= 1 && w.week <= 16)
      .map((w) => [w.week, w]),
  );
  if (byWeek.size === 0) return [];
  const maxWeek = Math.max(...Array.from(byWeek.keys()));
  const rows: Array<Array<WeekTotal | null>> = [];
  for (let start = 1; start <= maxWeek; start += 4) {
    const row: Array<WeekTotal | null> = [];
    for (let i = 0; i < 4; i++) {
      const weekNum = start + i;
      if (weekNum > maxWeek) {
        row.push(null);
      } else {
        const existing = byWeek.get(weekNum);
        row.push(existing ?? { week: weekNum, total: 0 });
      }
    }
    rows.push(row);
  }
  return rows;
}

export function WeeklyMortalityList({ weeks }: { weeks: WeekTotal[] }) {
  if (weeks.length === 0) return null;
  const rows = groupByFourWeekRows(weeks);

  return (
    <div className="mt-2 space-y-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-4 gap-x-2">
          {row.map((w, colIndex) =>
            w ? (
              <div key={w.week} className="min-w-0">
                <div className="text-[11px] font-bold leading-4 text-stone-500">
                  Wk{w.week}
                </div>
                <div className="text-[17px] font-extrabold leading-6 tabular-nums text-stone-900">
                  {w.total.toLocaleString()}
                </div>
              </div>
            ) : (
              <div key={`pad-${rowIndex}-${colIndex}`} className="min-w-0" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
