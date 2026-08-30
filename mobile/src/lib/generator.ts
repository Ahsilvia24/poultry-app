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

/** Keep the newest N hour-meter readings per generator. */
export const MAX_GENERATOR_HOUR_LOGS = 10;

/** Newest-first logs → oldest extra readings to drop (11th+ per generator). */
export function excessGeneratorHourCells<T extends { id: string } & GeneratorHours>(
  logsNewestFirst: T[],
  keep = MAX_GENERATOR_HOUR_LOGS,
): Array<{ id: string; hourKey: GenHourKey }> {
  const limit = keep > 0 ? Math.floor(keep) : 0;
  const excess: Array<{ id: string; hourKey: GenHourKey }> = [];
  for (const field of GENERATOR_FIELD_DEFS) {
    const withReading = logsNewestFirst.filter((log) => log[field.hourKey] != null);
    for (const log of withReading.slice(limit)) {
      excess.push({ id: log.id, hourKey: field.hourKey });
    }
  }
  return excess;
}

function asLoggedHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Newest-first logs → last reading for each generator (dates may differ). */
export function lastLoggedGeneratorHours(
  logsNewestFirst: Array<Partial<GeneratorHours>>,
): GeneratorHours {
  const last: GeneratorHours = {
    gen1Hours: null,
    gen2Hours: null,
    gen3Hours: null,
    gen4Hours: null,
  };
  for (const log of logsNewestFirst) {
    for (const field of GENERATOR_FIELD_DEFS) {
      if (last[field.hourKey] != null) continue;
      const hours = asLoggedHours(log[field.hourKey]);
      if (hours != null) last[field.hourKey] = hours;
    }
    if (GENERATOR_FIELD_DEFS.every((field) => last[field.hourKey] != null)) break;
  }
  return last;
}

/** Space-separated hours in gen 1… order. Skip gens with no log. */
export function formatLoggedGeneratorHourList(hours: GeneratorHours): string {
  return GENERATOR_FIELD_DEFS.map((field) => asLoggedHours(hours[field.hourKey]))
    .filter((n): n is number => n != null)
    .map((n) => formatGeneratorHours(n))
    .join("  ");
}

export function withPrebroodLoggedHours<
  T extends { generatorHoursCheckedOk?: string; generatorHoursLogged?: string },
>(form: T, hours: GeneratorHours): T {
  if (form.generatorHoursCheckedOk !== "yes") {
    return { ...form, generatorHoursLogged: "" };
  }
  return {
    ...form,
    generatorHoursLogged: formatLoggedGeneratorHourList(hours),
  };
}

function emptyGeneratorHours(): GeneratorHours {
  return { gen1Hours: null, gen2Hours: null, gen3Hours: null, gen4Hours: null };
}

function isHourDecrease(next: number, prev: number) {
  return Math.round(next * 10) < Math.round(prev * 10);
}

function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const pick = items[i]!;
    for (const rest of permute(items.filter((_, j) => j !== i))) {
      out.push([pick, ...rest]);
    }
  }
  return out;
}

function formatHourAssignment(hours: GeneratorHours): string {
  return GENERATOR_FIELD_DEFS.filter((field) => asLoggedHours(hours[field.hourKey]) != null)
    .map((field) => `${field.label} ${formatGeneratorHours(hours[field.hourKey])}`)
    .join(", ");
}

export type GeneratorHourSwapSuggestion = {
  entered: GeneratorHours;
  suggested: GeneratorHours;
  message: string;
};

/** Last reading per generator on or before a date, optionally skipping one log. */
export function previousGeneratorHoursFromLogs(
  logsNewestFirst: Array<{ id?: string; logDate: string } & Partial<GeneratorHours>>,
  opts: { onOrBeforeDate: string; excludeLogId?: string | null },
): GeneratorHours {
  return lastLoggedGeneratorHours(
    logsNewestFirst.filter(
      (log) => log.logDate <= opts.onOrBeforeDate && log.id !== opts.excludeLogId,
    ),
  );
}

/**
 * If entered hours look like they were typed on the wrong generators
 * (a different assignment has fewer decreases vs last readings), suggest a fix.
 */
export function detectGeneratorHourSwap(
  previous: GeneratorHours,
  entered: GeneratorHours,
): GeneratorHourSwapSuggestion | null {
  const keys = GENERATOR_FIELD_DEFS.map((field) => field.hourKey).filter(
    (key) => asLoggedHours(entered[key]) != null && asLoggedHours(previous[key]) != null,
  );
  if (keys.length === 0) return null;

  const enteredDecreases = keys.filter((key) =>
    isHourDecrease(asLoggedHours(entered[key])!, asLoggedHours(previous[key])!),
  ).length;
  if (enteredDecreases === 0) return null;

  let suggested: GeneratorHours | null = null;

  if (keys.length === 1) {
    const key = keys[0]!;
    const next = asLoggedHours(entered[key])!;
    let bestKey: GenHourKey | null = null;
    let bestPrev = Number.NEGATIVE_INFINITY;
    for (const field of GENERATOR_FIELD_DEFS) {
      const prev = asLoggedHours(previous[field.hourKey]);
      if (prev == null || isHourDecrease(next, prev)) continue;
      if (prev >= bestPrev) {
        bestPrev = prev;
        bestKey = field.hourKey;
      }
    }
    if (bestKey && bestKey !== key) {
      suggested = emptyGeneratorHours();
      for (const field of GENERATOR_FIELD_DEFS) {
        suggested[field.hourKey] =
          field.hourKey === key
            ? null
            : field.hourKey === bestKey
              ? next
              : asLoggedHours(entered[field.hourKey]);
      }
    }
  } else {
    const values = keys.map((key) => asLoggedHours(entered[key])!);
    let bestAssign = values;
    let bestDecreases = enteredDecreases;
    for (const assign of permute(values)) {
      const decreases = keys.filter((key, i) =>
        isHourDecrease(assign[i]!, asLoggedHours(previous[key])!),
      ).length;
      if (decreases < bestDecreases) {
        bestDecreases = decreases;
        bestAssign = assign;
      }
    }
    if (
      bestDecreases < enteredDecreases &&
      keys.some((key, i) => bestAssign[i] !== asLoggedHours(entered[key]))
    ) {
      suggested = { ...entered };
      keys.forEach((key, i) => {
        suggested![key] = bestAssign[i]!;
      });
    }
  }

  if (!suggested) return null;
  return {
    entered,
    suggested,
    message:
      `Hour meters usually go up. These look like they were logged on the wrong generators.\n\n` +
      `You entered: ${formatHourAssignment(entered)}\n` +
      `Suggested: ${formatHourAssignment(suggested)}\n\n` +
      `Fix the order, or save as entered if a meter was replaced.`,
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
