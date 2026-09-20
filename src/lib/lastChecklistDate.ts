import { isServiceFormKind } from "@/lib/serviceForms/stored";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const LAST_SERVICE_REPORT_LABEL = "Last Service Report";

/** yyyy-MM-dd from a checklist form date or LFO order date. */
export function checklistDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const key = String(value).slice(0, 10);
  return DATE_KEY.test(key) ? key : null;
}

export function latestDateKey(keys: Array<string | null | undefined>): string | null {
  const valid = keys.filter((key): key is string => Boolean(key && DATE_KEY.test(key)));
  if (!valid.length) return null;
  return valid.sort().at(-1) ?? null;
}

/**
 * Latest logged checklist date on a farm: service report, placement,
 * prebrood, or LFO. Farm visits do not count.
 */
export function lastServiceReportDateKey(input: {
  farmId: string;
  serviceForms?: Array<{
    farmId: string;
    formKind?: string;
    formDate?: string | Date | null;
  }>;
  lfos?: Array<{ farmId: string; orderDate?: string | Date | null }>;
}): string | null {
  const formDates = (input.serviceForms ?? [])
    .filter((row) => row.farmId === input.farmId)
    .filter((row) => !row.formKind || isServiceFormKind(row.formKind))
    .map((row) => checklistDateKey(row.formDate));
  const lfoDates = (input.lfos ?? [])
    .filter((row) => row.farmId === input.farmId)
    .map((row) => checklistDateKey(row.orderDate));
  return latestDateKey([...formDates, ...lfoDates]);
}
