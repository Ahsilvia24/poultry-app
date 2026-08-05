export const VISIT_TYPE_LABELS: Record<string, string> = {
  ROUTINE_SERVICE: "Routine Service",
  PREBROOD: "Prebrood",
  PLACEMENT: "Placement",
  WEIGHT_PROJECTION: "Weight Projection",
  LFO: "LFO",
  PRE_CATCH: "Pre-catch visit",
  HIGH_MORTALITY: "High mortality",
  VACCINATION: "Vaccination",
  MEDICATION: "Medication",
  EQUIPMENT_ISSUE: "Equipment issue",
  MORTALITY_INVESTIGATION: "Mortality investigation",
  OTHER: "Other",
  /** Kept for historical visits; not offered in the create/edit dropdown. */
  WEIGH_DAY: "Weigh day",
};

/** Dropdown order for create/edit visit forms. */
export const VISIT_TYPE_OPTIONS = [
  "ROUTINE_SERVICE",
  "PREBROOD",
  "PLACEMENT",
  "WEIGHT_PROJECTION",
  "LFO",
  "PRE_CATCH",
  "HIGH_MORTALITY",
  "VACCINATION",
  "MEDICATION",
  "EQUIPMENT_ISSUE",
  "MORTALITY_INVESTIGATION",
  "OTHER",
].map((value) => ({ value, label: VISIT_TYPE_LABELS[value]! }));
