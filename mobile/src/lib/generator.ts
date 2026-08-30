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
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

export type GeneratorDeltas = {
  gen1: number | null;
  gen2: number | null;
  gen3: number | null;
  gen4: number | null;
};

export type GenHourKey = keyof GeneratorHours;

export const GENERATOR_FIELD_DEFS = [
  { key: "gen1", label: "Gen 1", hourKey: "gen1Hours" as const, deltaKey: "gen1" as const },
  { key: "gen2", label: "Gen 2", hourKey: "gen2Hours" as const, deltaKey: "gen2" as const },
  { key: "gen3", label: "Gen 3", hourKey: "gen3Hours" as const, deltaKey: "gen3" as const },
  { key: "gen4", label: "Gen 4", hourKey: "gen4Hours" as const, deltaKey: "gen4" as const },
] as const;

/** Newest-first logs → last reading for each generator. */
export function lastLoggedGeneratorHours(
  logsNewestFirst: GeneratorHours[],
): GeneratorHours {
  const last: GeneratorHours = {
    gen1Hours: null,
    gen2Hours: null,
    gen3Hours: null,
    gen4Hours: null,
  };
  for (const log of logsNewestFirst) {
    for (const field of GENERATOR_FIELD_DEFS) {
      if (last[field.hourKey] == null && log[field.hourKey] != null) {
        last[field.hourKey] = log[field.hourKey];
      }
    }
    if (GENERATOR_FIELD_DEFS.every((field) => last[field.hourKey] != null)) break;
  }
  return last;
}

/** Space-separated hours in gen 1… order. Skip gens with no log. */
export function formatLoggedGeneratorHourList(
  hours: GeneratorHours,
  generatorCount?: number | null,
): string {
  const max =
    generatorCount != null && generatorCount > 0 ? Math.min(4, Math.floor(generatorCount)) : 4;
  return GENERATOR_FIELD_DEFS.slice(0, max)
    .map((field) => hours[field.hourKey])
    .filter((n): n is number => n != null && Number.isFinite(n))
    .map((n) => formatGeneratorHours(n))
    .join("  ");
}

export function withPrebroodLoggedHours<
  T extends { generatorHoursCheckedOk?: string; generatorHoursLogged?: string },
>(form: T, hours: GeneratorHours, generatorCount?: number | null): T {
  if (form.generatorHoursCheckedOk !== "yes") {
    return { ...form, generatorHoursLogged: "" };
  }
  return {
    ...form,
    generatorHoursLogged: formatLoggedGeneratorHourList(hours, generatorCount),
  };
}

export function isGenHourKey(value: unknown): value is GenHourKey {
  return (
    value === "gen1Hours" ||
    value === "gen2Hours" ||
    value === "gen3Hours" ||
    value === "gen4Hours"
  );
}

export function parseOptionalGeneratorHours(raw: unknown): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Generator hours must be 0 or greater");
  }
  return n;
}

export function logHasAnyGeneratorReading(hours: GeneratorHours): boolean {
  return GENERATOR_FIELD_DEFS.some((field) => hours[field.hourKey] != null);
}

export function hoursDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const d = Math.round((current - previous) * 10) / 10;
  return d >= 0 ? d : null;
}

export function generatorDeltas(
  current: GeneratorHours,
  previous: GeneratorHours | null | undefined,
): GeneratorDeltas {
  if (!previous) {
    return { gen1: null, gen2: null, gen3: null, gen4: null };
  }
  return {
    gen1: hoursDelta(current.gen1Hours, previous.gen1Hours),
    gen2: hoursDelta(current.gen2Hours, previous.gen2Hours),
    gen3: hoursDelta(current.gen3Hours, previous.gen3Hours),
    gen4: hoursDelta(current.gen4Hours, previous.gen4Hours),
  };
}

export function formatGeneratorCopyLine(
  hours: GeneratorHours,
  deltas: GeneratorDeltas,
): string {
  const parts: string[] = [];
  for (const field of GENERATOR_FIELD_DEFS) {
    parts.push(formatGeneratorHours(hours[field.hourKey]));
    parts.push(formatGeneratorHours(deltas[field.deltaKey]));
  }
  return parts.join(", ");
}

export function formatGeneratorLogCopy(input: {
  logDateLabel: string;
  hours: GeneratorHours;
  deltas: GeneratorDeltas;
}): string {
  return `${input.logDateLabel}\n${formatGeneratorCopyLine(input.hours, input.deltas)}`;
}

/** Text-friendly paste of Date / Hours / Exercised for gens that have readings. */
export function formatGeneratorChartsCopy(
  logs: Array<{
    dateLabel: string;
    hours: GeneratorHours;
    deltas: GeneratorDeltas;
  }>,
): string {
  if (logs.length === 0) return "";

  const pad = (value: string, width: number) => value.padEnd(width, " ");

  return GENERATOR_FIELD_DEFS.map((gen) => {
    const rows = logs
      .filter((log) => log.hours[gen.hourKey] != null)
      .map((log) => ({
        date: log.dateLabel,
        hours: formatGeneratorHours(log.hours[gen.hourKey]),
        exercised: formatGeneratorHours(log.deltas[gen.deltaKey]),
      }));
    if (rows.length === 0) return null;

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
    .filter(Boolean)
    .join("\n\n");
}
