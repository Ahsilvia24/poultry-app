export const VISIT_TYPE_LABELS: Record<string, string> = {
  ROUTINE_SERVICE: "Routine service visit",
  PLACEMENT: "Placement",
  SEVEN_DAY: "7-day visit",
  WEIGH_DAY: "Weigh day",
  VACCINATION: "Vaccination",
  MEDICATION: "Medication",
  EQUIPMENT_ISSUE: "Equipment issue",
  MORTALITY_INVESTIGATION: "Mortality investigation",
  PRE_CATCH: "Pre-catch visit",
  OTHER: "Other",
};

export const VISIT_TYPE_OPTIONS = Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
