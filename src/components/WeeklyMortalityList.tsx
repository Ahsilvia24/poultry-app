type WeekTotal = { week: number; total: number };

/** Weeks 1–4 / 5–8 / 9–12 as fixed 4-column rows (empty slots keep columns aligned). */
function groupByFourWeekRows(weeks: WeekTotal[]): Array<Array<WeekTotal | null>> {
  if (weeks.length === 0) return [];
  const byWeek = new Map(weeks.map((w) => [Math.max(1, w.week), w]));
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
        <div key={rowIndex} className="grid grid-cols-4 gap-x-3 gap-y-1">
          {row.map((w, colIndex) =>
            w ? (
              <div key={w.week} className="min-w-0 text-base leading-snug text-stone-500">
                Week {w.week}{" "}
                <span className="text-lg font-extrabold text-stone-900">{w.total}</span>
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
