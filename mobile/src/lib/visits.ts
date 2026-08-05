export const VISIT_TYPE_LABELS: Record<string, string> = {
  ROUTINE_SERVICE: "Routine service visit",
  PRE_CATCH: "Pre-catch visit",
  PLACEMENT: "Placement",
  WEIGHT_PROJECTION: "Weight Projection",
  LFO: "LFO",
  HIGH_MORTALITY: "High mortality",
  PREBROOD: "Prebrood",
  WEIGH_DAY: "Weigh day",
  VACCINATION: "Vaccination",
  MEDICATION: "Medication",
  EQUIPMENT_ISSUE: "Equipment issue",
  MORTALITY_INVESTIGATION: "Mortality investigation",
  OTHER: "Other",
};

/** Dropdown order for create/edit visit forms. */
export const VISIT_TYPE_OPTIONS = [
  "ROUTINE_SERVICE",
  "PRE_CATCH",
  "PLACEMENT",
  "WEIGHT_PROJECTION",
  "LFO",
  "HIGH_MORTALITY",
  "PREBROOD",
  "WEIGH_DAY",
  "VACCINATION",
  "MEDICATION",
  "EQUIPMENT_ISSUE",
  "MORTALITY_INVESTIGATION",
  "OTHER",
].map((value) => ({ value, label: VISIT_TYPE_LABELS[value]! }));
