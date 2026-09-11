export function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function dateKeyOrNull(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function asDateRequired(value: string | Date): Date {
  return asDate(value) ?? new Date(0);
}

export function asDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return dateKeyOrNull(value);
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : dateKeyOrNull(new Date(value));
}

/** Local noon from yyyy-MM-dd — safe for startOfDay / calendar math. */
export function localNoonFromKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}
