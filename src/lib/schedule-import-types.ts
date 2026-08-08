export const SCHEDULE_IMPORT_TYPES = [
  { id: "placement", label: "Placements" },
  { id: "kill", label: "Kill schedules" },
  { id: "catch", label: "Catch dates" },
] as const;

export type ScheduleImportType = (typeof SCHEDULE_IMPORT_TYPES)[number]["id"];

export type ScheduleImportMeta = {
  id: string;
  importType: ScheduleImportType;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByUserId: string;
};

export function isScheduleImportType(value: string): value is ScheduleImportType {
  return SCHEDULE_IMPORT_TYPES.some((t) => t.id === value);
}

export function scheduleImportTypeLabel(type: ScheduleImportType) {
  return SCHEDULE_IMPORT_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Stable across server/client. */
export function formatUploadedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}
