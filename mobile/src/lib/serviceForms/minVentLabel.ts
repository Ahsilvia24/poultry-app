export function formatMinVentBoxNumbers(on: string, off: string) {
  const a = on.trim();
  const b = off.trim();
  if (!a && !b) return "";
  if (a && b) return `${a} / ${b}`;
  return a || b;
}

export function recommendedWeekLabel(week: number | "" | null | undefined) {
  if (week === "" || week == null || week === 0) return "Blank";
  return `Week ${week}`;
}

export const WEEK_OPTIONS = [
  { value: "", label: "Blank" },
  ...Array.from({ length: 8 }, (_, i) => ({
    value: String(i + 1),
    label: `Week ${i + 1}`,
  })),
];
