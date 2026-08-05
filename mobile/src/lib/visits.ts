export const VISIT_TYPE_LABELS: Record<string, string> = {
  ROUTINE_SERVICE: "Routine Service",
  PREBROOD: "Prebrood",
  PLACEMENT: "Placement",
  WEIGHT_PROJECTION: "Weight Projection",
  LFO: "LFO",
  PRE_CATCH: "Pre-catch visit",
  MORTALITY_INVESTIGATION: "Mortality investigation",
  VACCINATION: "Vaccination",
  MEDICATION: "Medication",
  EQUIPMENT_ISSUE: "Equipment issue",
  OTHER: "Other",
  /** Kept for historical visits; not offered in the create/edit dropdown. */
  WEIGH_DAY: "Weigh day",
  HIGH_MORTALITY: "High mortality",
};

/** Dropdown order for create/edit visit forms. */
export const VISIT_TYPE_OPTIONS = [
  "ROUTINE_SERVICE",
  "PREBROOD",
  "PLACEMENT",
  "WEIGHT_PROJECTION",
  "LFO",
  "PRE_CATCH",
  "MORTALITY_INVESTIGATION",
  "VACCINATION",
  "MEDICATION",
  "EQUIPMENT_ISSUE",
  "OTHER",
].map((value) => ({ value, label: VISIT_TYPE_LABELS[value]! }));
