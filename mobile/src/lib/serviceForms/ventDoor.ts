export type VentDoorType = "ceiling" | "sidewall";

export const VENT_DOOR_OPTIONS: { value: VentDoorType; label: string }[] = [
  { value: "ceiling", label: "Ceiling" },
  { value: "sidewall", label: "Sidewall" },
];

/** Accepts the new array, or a leftover single string from older saved forms. */
export function normalizeVentDoorTypes(value: unknown): VentDoorType[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is VentDoorType => v === "ceiling" || v === "sidewall");
  }
  if (value === "ceiling" || value === "sidewall") return [value];
  return [];
}

export function ventDoorTypesFromPayload(payload: {
  ventDoorTypes?: unknown;
  ventDoorType?: unknown;
}): VentDoorType[] {
  if (payload.ventDoorTypes != null) return normalizeVentDoorTypes(payload.ventDoorTypes);
  return normalizeVentDoorTypes(payload.ventDoorType);
}
