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
};

/** Dropdown order for create/edit visit forms. */
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
