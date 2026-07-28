/** Format hour-meter / run hours like 235, 234.5, or .5 */
export function formatGeneratorHours(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(1);
  if (rounded > -1 && rounded < 1 && rounded !== 0) {
    return fixed.replace(/^(-?)0/, "$1");
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

export function formatGeneratorCopyLine(hours: GeneratorHours, deltas: GeneratorDeltas): string {
  return [
    formatGeneratorHours(hours.gen1Hours),
    formatGeneratorHours(deltas.gen1),
    formatGeneratorHours(hours.gen2Hours),
    formatGeneratorHours(deltas.gen2),
    formatGeneratorHours(hours.gen3Hours),
    formatGeneratorHours(deltas.gen3),
    formatGeneratorHours(hours.gen4Hours),
    formatGeneratorHours(deltas.gen4),
  ].join(", ");
}

export function formatGeneratorLogCopy(input: {
  logDateLabel: string;
  hours: GeneratorHours;
  deltas: GeneratorDeltas;
}): string {
  return `${input.logDateLabel}\n${formatGeneratorCopyLine(input.hours, input.deltas)}`;
}

const GEN_COPY_FIELDS = [
  { label: "Gen 1", hourKey: "gen1Hours" as const, deltaKey: "gen1" as const },
  { label: "Gen 2", hourKey: "gen2Hours" as const, deltaKey: "gen2" as const },
  { label: "Gen 3", hourKey: "gen3Hours" as const, deltaKey: "gen3" as const },
  { label: "Gen 4", hourKey: "gen4Hours" as const, deltaKey: "gen4" as const },
];

/** Text-friendly paste of Date / Hours / Exercised for all gens. */
export function formatGeneratorChartsCopy(
  logs: Array<{
    dateLabel: string;
    hours: GeneratorHours;
    deltas: GeneratorDeltas;
  }>,
): string {
  if (logs.length === 0) return "";
  return GEN_COPY_FIELDS.map((gen) => {
    const lines = [
      gen.label,
      "Date\tHours\tExercised",
      ...logs.map(
        (log) =>
          `${log.dateLabel}\t${formatGeneratorHours(log.hours[gen.hourKey])}\t${formatGeneratorHours(log.deltas[gen.deltaKey])}`,
      ),
    ];
    return lines.join("\n");
  }).join("\n\n");
}
