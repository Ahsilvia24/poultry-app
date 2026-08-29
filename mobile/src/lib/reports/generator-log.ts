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
  priorHours?: GeneratorReportHours | null;
};

export const GENERATOR_REPORT_COLUMNS = [
  { key: "gen1Hours", label: "Gen 1" },
  { key: "gen2Hours", label: "Gen 2" },
  { key: "gen3Hours", label: "Gen 3" },
  { key: "gen4Hours", label: "Gen 4" },
] as const;

export type GeneratorReportColumnKey = (typeof GENERATOR_REPORT_COLUMNS)[number]["key"];

export type GeneratorReportWeekRow = {
  logDate: string;
  hours: number | null;
  exercised: number | null;
};

export type GeneratorReportGenerator = {
  key: GeneratorReportColumnKey;
  label: string;
  rows: GeneratorReportWeekRow[];
};

export type GeneratorReportViewFarm = {
  farmId: string;
  farmName: string;
  generators: GeneratorReportGenerator[];
};

export function formatGeneratorReportDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

function hoursDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const d = Math.round((current - previous) * 10) / 10;
  return d >= 0 ? d : null;
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

export function emptyPriorHours(): GeneratorReportHours {
  return { gen1Hours: null, gen2Hours: null, gen3Hours: null, gen4Hours: null };
}

/** Fold older logs (newest first) into the last reading per generator. */
export function collectPriorHours(
  olderLogsNewestFirst: GeneratorReportHours[],
): GeneratorReportHours {
  const prior = emptyPriorHours();
  for (const log of olderLogsNewestFirst) {
    for (const col of GENERATOR_REPORT_COLUMNS) {
      if (prior[col.key] == null && log[col.key] != null) {
        prior[col.key] = log[col.key];
      }
    }
    if (GENERATOR_REPORT_COLUMNS.every((col) => prior[col.key] != null)) break;
  }
  return prior;
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

/** Unique log dates, newest first, shared by every generator on the farm. */
export function generatorReportDates(farm: GeneratorReportFarm): string[] {
  const dates = new Set<string>();
  for (const log of farm.logs) dates.add(log.logDate);
  return [...dates].sort((a, b) => b.localeCompare(a));
}

export function buildGeneratorReportView(
  farms: GeneratorReportFarm[],
): GeneratorReportViewFarm[] {
  return farms.map((farm) => {
    const columns = generatorColumnsForFarm(farm);
    const datesNewestFirst = generatorReportDates(farm);
    const datesOldestFirst = [...datesNewestFirst].reverse();
    const logByDate = new Map<string, GeneratorReportLog>();
    for (const log of farm.logs) {
      if (!logByDate.has(log.logDate)) logByDate.set(log.logDate, log);
    }

    const generators = columns.map((col) => {
      let previous = farm.priorHours?.[col.key] ?? null;
      const oldestFirst = datesOldestFirst.map((logDate) => {
        const hours = logByDate.get(logDate)?.[col.key] ?? null;
        const exercised = hoursDelta(hours, previous);
        if (hours != null) previous = hours;
        return { logDate, hours, exercised };
      });
      return {
        key: col.key,
        label: col.label,
        rows: oldestFirst.reverse(),
      };
    });

    return {
      farmId: farm.farmId,
      farmName: farm.farmName,
      generators,
    };
  });
}

export function generatorReportToTsv(farms: GeneratorReportViewFarm[]): string {
  const lines: string[] = [];
  for (const farm of farms) {
    if (lines.length > 0) lines.push("");
    lines.push(farm.farmName);
    for (const gen of farm.generators) {
      if (lines[lines.length - 1] !== farm.farmName) lines.push("");
      lines.push(gen.label);
      lines.push(["Date", "Hours", "Exercised"].join("\t"));
      for (const row of gen.rows) {
        lines.push(
          [
            formatGeneratorReportDate(row.logDate),
            formatGeneratorReportHours(row.hours),
            formatGeneratorReportHours(row.exercised),
          ].join("\t"),
        );
      }
    }
  }
  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generatorReportToHtml(opts: {
  title?: string;
  subtitle?: string;
  farms: GeneratorReportViewFarm[];
}): string {
  const title = opts.title ?? "Generator Hours";
  const farmsHtml = opts.farms
    .map((farm) => {
      const gens = farm.generators
        .map((gen) => {
          const rows = gen.rows
            .map(
              (row) =>
                `<tr><td>${escapeHtml(formatGeneratorReportDate(row.logDate))}</td><td>${escapeHtml(formatGeneratorReportHours(row.hours))}</td><td>${escapeHtml(formatGeneratorReportHours(row.exercised))}</td></tr>`,
            )
            .join("");
          return `<h3>${escapeHtml(gen.label)}</h3>
<table>
  <thead><tr><th>Date</th><th>Hours</th><th>Exercised</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
        })
        .join("");
      return `<h2>${escapeHtml(farm.farmName)}</h2>${gens}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1c1917; padding: 28px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #57534e; font-size: 12px; margin: 0 0 22px; }
  h2 { font-size: 18px; margin: 22px 0 10px; }
  h3 { font-size: 14px; margin: 14px 0 6px; }
  table { border-collapse: collapse; width: 100%; max-width: 28rem; margin-bottom: 4px; }
  th, td { text-align: left; padding: 5px 12px 5px 0; font-size: 13px; }
  th { color: #78716c; font-weight: 700; border-bottom: 1px solid #e7e5e4; }
  td { font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ""}
  ${farmsHtml}
</body>
</html>`;
}
