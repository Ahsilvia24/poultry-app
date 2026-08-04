export const VISIT_TYPE_LABELS: Record<string, string> = {
  PRE_CATCH: "Pre-catch visit",
  PLACEMENT: "Placement",
  WEIGHT_PROJECTION: "Weight Projection",
  LFO: "LFO",
  HIGH_MORTALITY: "High mortality",
  ROUTINE_SERVICE: "Routine service visit",
  PREBROOD: "Prebrood",
  WEIGH_DAY: "Weigh day",
  VACCINATION: "Vaccination",
  MEDICATION: "Medication",
  EQUIPMENT_ISSUE: "Equipment issue",
  MORTALITY_INVESTIGATION: "Mortality investigation",
  OTHER: "Other",
  /** Kept for historical visits; not offered in the create/edit dropdown. */
  SEVEN_DAY: "7-day visit",
};

/** Dropdown order for new/edited visits (excludes retired types like 7-day). */
export const VISIT_TYPE_OPTIONS = [
  "PRE_CATCH",
  "PLACEMENT",
  "WEIGHT_PROJECTION",
  "LFO",
  "HIGH_MORTALITY",
  "ROUTINE_SERVICE",
  "PREBROOD",
  "WEIGH_DAY",
  "VACCINATION",
  "MEDICATION",
  "EQUIPMENT_ISSUE",
  "MORTALITY_INVESTIGATION",
  "OTHER",
].map((value) => ({ value, label: VISIT_TYPE_LABELS[value]! }));

/** Options for the visit-type picker; keeps a retired current value selectable when editing. */
export function visitTypeSelectOptions(current?: string | null) {
  if (!current || VISIT_TYPE_OPTIONS.some((o) => o.value === current)) {
    return VISIT_TYPE_OPTIONS;
  }
  const label = VISIT_TYPE_LABELS[current] ?? current;
  return [...VISIT_TYPE_OPTIONS, { value: current, label }];
}
