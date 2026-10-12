const GEN_LOG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Farm generator log date: `August 26, 2026`. */
export function formatGeneratorLogDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const mon = GEN_LOG_MONTHS[m - 1];
  if (!mon) return dateKey;
  return `${mon} ${d}, ${y}`;
}

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

export function isGenHourKey(value: unknown): value is GenHourKey {
  return (
    value === "gen1Hours" ||
    value === "gen2Hours" ||
    value === "gen3Hours" ||
    value === "gen4Hours"
  );
}

/** Empty / missing → null (no reading for that generator). */
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

function asLoggedHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyGeneratorHours(): GeneratorHours {
  return { gen1Hours: null, gen2Hours: null, gen3Hours: null, gen4Hours: null };
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

function roundHour(n: number) {
  return Math.round(n * 10) / 10;
}

/** How far a reading sits from this generator's previous and following logs. */
function placementCost(
  value: number,
  key: GenHourKey,
  previous: GeneratorHours,
  next: GeneratorHours | null | undefined,
): number | null {
  const prev = asLoggedHours(previous[key]);
  const following = asLoggedHours(next?.[key]);
  if (prev == null && following == null) return null;
  return (
    (prev == null ? 0 : Math.abs(value - prev)) +
    (following == null ? 0 : Math.abs(value - following))
  );
}

function knownAnchors(previous: GeneratorHours, next: GeneratorHours | null | undefined) {
  const anchors: number[] = [];
  for (const field of GENERATOR_FIELD_DEFS) {
    const prev = asLoggedHours(previous[field.hourKey]);
    const following = asLoggedHours(next?.[field.hourKey]);
    if (prev != null) anchors.push(prev);
    if (following != null) anchors.push(following);
  }
  return anchors;
}

/** A replaced meter starts near zero, well below every generator already logged. */
function isReplacedMeter(value: number, anchors: number[]) {
  if (anchors.length === 0) return false;
  const smallest = Math.min(...anchors);
  return value < smallest && value <= smallest / 2;
}

/** Ignore a reshuffle that is only a few tenths closer. */
const MIN_SWAP_IMPROVEMENT = 0.5;

function closerAssignment(
  keys: GenHourKey[],
  values: number[],
  previous: GeneratorHours,
  next: GeneratorHours | null | undefined,
): number[] | null {
  const enteredCost = keys.reduce(
    (sum, key, i) => sum + (placementCost(values[i]!, key, previous, next) ?? 0),
    0,
  );
  let bestAssign = values;
  let bestCost = enteredCost;
  for (const assign of permute(values)) {
    const cost = keys.reduce(
      (sum, key, i) => sum + (placementCost(assign[i]!, key, previous, next) ?? 0),
      0,
    );
    if (cost < bestCost - 1e-9 && roundHour(enteredCost - cost) >= MIN_SWAP_IMPROVEMENT) {
      bestCost = cost;
      bestAssign = assign;
    }
  }
  if (keys.every((key, i) => bestAssign[i] === values[i])) return null;
  return bestAssign;
}

/**
 * If entered hours are closer to a different generator's readings
 * (the log before this date, and the log after it when one exists), suggest that order.
 * 217 and 174 stay matched to 216 and 178 even when one meter dipped.
 */
export function detectGeneratorHourSwap(
  previous: GeneratorHours,
  entered: GeneratorHours,
  next?: GeneratorHours | null,
): GeneratorHourSwapSuggestion | null {
  const anchors = knownAnchors(previous, next);
  if (anchors.length === 0) return null;

  const enteredKeys = GENERATOR_FIELD_DEFS.map((field) => field.hourKey).filter(
    (key) => asLoggedHours(entered[key]) != null,
  );
  const pinned = new Set<GenHourKey>(
    enteredKeys.filter((key) => isReplacedMeter(asLoggedHours(entered[key])!, anchors)),
  );
  const scored = enteredKeys.filter(
    (key) =>
      !pinned.has(key) && placementCost(asLoggedHours(entered[key])!, key, previous, next) != null,
  );
  if (scored.length === 0) return null;

  let suggested: GeneratorHours | null = null;

  if (scored.length === 1) {
    const key = scored[0]!;
    const value = asLoggedHours(entered[key])!;
    const enteredCost = placementCost(value, key, previous, next)!;
    let bestKey: GenHourKey = key;
    let bestCost = enteredCost;
    for (const field of GENERATOR_FIELD_DEFS) {
      if (pinned.has(field.hourKey)) continue;
      const cost = placementCost(value, field.hourKey, previous, next);
      if (cost == null) continue;
      if (cost < bestCost - 1e-9 && roundHour(enteredCost - cost) >= MIN_SWAP_IMPROVEMENT) {
        bestCost = cost;
        bestKey = field.hourKey;
      }
    }
    if (bestKey !== key) {
      suggested = { ...entered, [key]: null, [bestKey]: value };
    }
  } else {
    const values = scored.map((key) => asLoggedHours(entered[key])!);
    const bestAssign = closerAssignment(scored, values, previous, next);
    if (bestAssign) {
      suggested = { ...entered };
      scored.forEach((key, i) => {
        suggested![key] = bestAssign[i]!;
      });
    }
  }

  if (!suggested) return null;
  return {
    entered,
    suggested,
    message:
      `These hours look closer to a different generator.\n\n` +
      `You entered: ${formatHourAssignment(entered)}\n` +
      `Suggested: ${formatHourAssignment(suggested)}\n\n` +
      `Fix the order, or save as entered if a meter was replaced.`,
  };
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

/** Newest-first logs → last reading for each generator (dates may differ). */
export function lastLoggedGeneratorHours(
  logsNewestFirst: Array<Partial<GeneratorHours>>,
): GeneratorHours {
  const last: GeneratorHours = emptyGeneratorHours();
  for (const log of logsNewestFirst) {
    for (const field of GENERATOR_FIELD_DEFS) {
      if (last[field.hourKey] != null) continue;
      const hours = asLoggedHours(log[field.hourKey]);
      if (hours != null) last[field.hourKey] = hours;
    }
  }
  return last;
}

function generatorDateKey(value: string) {
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

/**
 * Readings on the log before this date, and the log after it.
 * The date being entered is not part of either side.
 */
export function generatorHoursAroundDate(
  logs: Array<{ id?: string; logDate: string } & Partial<GeneratorHours>>,
  opts: { date: string; excludeLogId?: string | null },
): { previous: GeneratorHours; next: GeneratorHours } {
  const date = generatorDateKey(opts.date);
  if (!date) {
    const none = lastLoggedGeneratorHours([]);
    return { previous: none, next: none };
  }
  const rows = logs.filter((log) => log.id !== opts.excludeLogId && generatorDateKey(log.logDate));
  const previousLogs = rows
    .filter((log) => generatorDateKey(log.logDate) < date)
    .sort(
      (a, b) =>
        generatorDateKey(b.logDate).localeCompare(generatorDateKey(a.logDate)) ||
        (b.id ?? "").localeCompare(a.id ?? ""),
    );
  const nextLogs = rows
    .filter((log) => generatorDateKey(log.logDate) > date)
    .sort(
      (a, b) =>
        generatorDateKey(a.logDate).localeCompare(generatorDateKey(b.logDate)) ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    );
  return {
    previous: lastLoggedGeneratorHours(previousLogs),
    next: lastLoggedGeneratorHours(nextLogs),
  };
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

/** Compact copy line: 234.5, .5, 235, .5 (reading, run hours × N gens). */
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
