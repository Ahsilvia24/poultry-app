type WeekTotal = { week: number; total: number };

function groupByFourWeekRows(weeks: WeekTotal[]): WeekTotal[][] {
  const rows = new Map<number, WeekTotal[]>();
  for (const w of weeks) {
    const rowIndex = Math.floor((Math.max(1, w.week) - 1) / 4);
    const list = rows.get(rowIndex) ?? [];
    list.push(w);
    rows.set(rowIndex, list);
  }
  return Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list.sort((a, b) => a.week - b.week));
}

export function WeeklyMortalityList({ weeks }: { weeks: WeekTotal[] }) {
  if (weeks.length === 0) return null;
  const rows = groupByFourWeekRows(weeks);

  return (
    <div className="mt-2 space-y-2">
      {rows.map((row) => (
        <div key={row[0]!.week} className="grid grid-cols-4 gap-x-3 gap-y-1">
          {row.map((w) => (
            <div key={w.week} className="min-w-0 text-base leading-snug text-stone-500">
              Week {w.week}{" "}
              <span className="text-lg font-extrabold text-stone-900">{w.total}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
