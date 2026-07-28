/** Format hour-meter / run hours like 235, 234.5, or .5 */
export function formatGeneratorHours(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(1);
  if (rounded > -1 && rounded < 1 && rounded !== 0) {
    return fixed.replace(/^(-?)0/, "$1"); // .5 or -.5
  }
  return fixed;
}

export type GeneratorHours = {
  gen1Hours: number;
  gen2Hours: number;
  gen3Hours: number;
  gen4Hours: number;
};

export type GeneratorDeltas = {
  gen1: number | null;
  gen2: number | null;
  gen3: number | null;
  gen4: number | null;
};

export function generatorDeltas(
  current: GeneratorHours,
  previous: GeneratorHours | null | undefined,
): GeneratorDeltas {
  if (!previous) {
    return { gen1: null, gen2: null, gen3: null, gen4: null };
  }
  const delta = (cur: number, prev: number) => {
    const d = Math.round((cur - prev) * 10) / 10;
    return d >= 0 ? d : null;
  };
  return {
    gen1: delta(current.gen1Hours, previous.gen1Hours),
    gen2: delta(current.gen2Hours, previous.gen2Hours),
    gen3: delta(current.gen3Hours, previous.gen3Hours),
    gen4: delta(current.gen4Hours, previous.gen4Hours),
  };
}

/** Compact copy line: 234.5, .5, 235, .5 (reading, run hours × N gens). */
export function formatGeneratorCopyLine(
  hours: GeneratorHours,
  deltas: GeneratorDeltas,
  generatorCount: number = 4,
): string {
  const fields = generatorFieldsForCount(generatorCount);
  const parts: string[] = [];
  for (const field of fields) {
    parts.push(formatGeneratorHours(hours[field.hourKey]));
    parts.push(formatGeneratorHours(deltas[field.deltaKey]));
  }
  return parts.join(", ");
}

export function formatGeneratorLogCopy(input: {
  logDateLabel: string;
  hours: GeneratorHours;
  deltas: GeneratorDeltas;
  generatorCount?: number;
}): string {
  return `${input.logDateLabel}\n${formatGeneratorCopyLine(input.hours, input.deltas, input.generatorCount)}`;
}

/** Clamp farm generator count to supported 1–4 range. */
export function clampGeneratorCount(n: number | null | undefined): number {
  const v = Math.floor(Number(n) || 4);
  return Math.min(4, Math.max(1, v));
}

export const GENERATOR_FIELD_DEFS = [
  { key: "gen1", label: "Gen 1", hourKey: "gen1Hours" as const, deltaKey: "gen1" as const },
  { key: "gen2", label: "Gen 2", hourKey: "gen2Hours" as const, deltaKey: "gen2" as const },
  { key: "gen3", label: "Gen 3", hourKey: "gen3Hours" as const, deltaKey: "gen3" as const },
  { key: "gen4", label: "Gen 4", hourKey: "gen4Hours" as const, deltaKey: "gen4" as const },
] as const;

export function generatorFieldsForCount(count: number | null | undefined) {
  return GENERATOR_FIELD_DEFS.slice(0, clampGeneratorCount(count));
}

/** Text-friendly paste of Date / Hours / Exercised for configured gens. */
export function formatGeneratorChartsCopy(
  logs: Array<{
    dateLabel: string;
    hours: GeneratorHours;
    deltas: GeneratorDeltas;
  }>,
  generatorCount: number = 4,
): string {
  if (logs.length === 0) return "";

  const pad = (value: string, width: number) => value.padEnd(width, " ");
  const fields = generatorFieldsForCount(generatorCount);

  return fields
    .map((gen) => {
      const rows = logs.map((log) => ({
        date: log.dateLabel,
        hours: formatGeneratorHours(log.hours[gen.hourKey]),
        exercised: formatGeneratorHours(log.deltas[gen.deltaKey]),
      }));
      const dateWidth = Math.max(4, "Date".length, ...rows.map((r) => r.date.length));
      const hoursWidth = Math.max(5, "Hours".length, ...rows.map((r) => r.hours.length));
      const lines = [
        gen.label,
        `${pad("Date", dateWidth)}    ${pad("Hours", hoursWidth)}    Exercised`,
        ...rows.map(
          (r) => `${pad(r.date, dateWidth)}    ${pad(r.hours, hoursWidth)}    ${r.exercised}`,
        ),
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}
