export type GeneratorReportHours = {
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

export type GeneratorReportLog = GeneratorReportHours & {
  id: string;
  farmId: string;
  farmName: string;
  logDate: string;
};

export type GeneratorReportFarm = {
  farmId: string;
  farmName: string;
  numberOfGenerators: number | null;
  logs: GeneratorReportLog[];
};

export const GENERATOR_REPORT_COLUMNS = [
  { key: "gen1Hours", label: "Gen 1" },
  { key: "gen2Hours", label: "Gen 2" },
  { key: "gen3Hours", label: "Gen 3" },
  { key: "gen4Hours", label: "Gen 4" },
] as const;

export function formatGeneratorReportDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

export function formatGeneratorReportHours(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(1);
  if (rounded > -1 && rounded < 1 && rounded !== 0) {
    return fixed.replace(/^(-?)0/, "$1");
  }
  return fixed;
}

export function generatorColumnsForFarm(
  farm: GeneratorReportFarm,
): Array<(typeof GENERATOR_REPORT_COLUMNS)[number]> {
  const count = farm.numberOfGenerators;
  if (count != null && count > 0) {
    return GENERATOR_REPORT_COLUMNS.slice(0, Math.min(4, count));
  }
  return GENERATOR_REPORT_COLUMNS.filter((col) =>
    farm.logs.some((log) => log[col.key] != null),
  );
}

export function generatorReportToTsv(
  farms: GeneratorReportFarm[],
  includeFarmColumn: boolean,
): string {
  const header = includeFarmColumn
    ? ["Farm", "Date", ...GENERATOR_REPORT_COLUMNS.map((c) => c.label)]
    : ["Date", ...GENERATOR_REPORT_COLUMNS.map((c) => c.label)];
  const lines = [header.join("\t")];
  for (const farm of farms) {
    for (const log of farm.logs) {
      const cells = [
        formatGeneratorReportDate(log.logDate),
        formatGeneratorReportHours(log.gen1Hours),
        formatGeneratorReportHours(log.gen2Hours),
        formatGeneratorReportHours(log.gen3Hours),
        formatGeneratorReportHours(log.gen4Hours),
      ];
      lines.push((includeFarmColumn ? [farm.farmName, ...cells] : cells).join("\t"));
    }
  }
  return lines.join("\n");
}
