/** Quick Calc saved LFOs are labeled Custom 1, Custom 2, … */
const CUSTOM_LFO_NAME = /^Custom\s+(\d+)$/i;

export function parseCustomLfoNumber(name: string | null | undefined): number | null {
  const match = CUSTOM_LFO_NAME.exec((name ?? "").trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function nextCustomLfoName(existingNames: Iterable<string | null | undefined>): string {
  let max = 0;
  for (const name of existingNames) {
    const n = parseCustomLfoNumber(name);
    if (n != null) max = Math.max(max, n);
  }
  return `Custom ${max + 1}`;
}

/** Show Custom N from notes when present; otherwise the farm name. */
export function lfoDisplayName(
  farmName: string,
  notes: string | null | undefined,
): string {
  const labeled = notes?.trim() ?? "";
  return parseCustomLfoNumber(labeled) != null ? labeled : farmName;
}
