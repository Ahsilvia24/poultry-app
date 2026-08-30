/** Picker order and labels for a new/edited visit. */
export const VISIT_TYPE_OPTIONS = [
  { value: "ROUTINE_SERVICE", label: "Routine Service" },
  { value: "PREBROOD", label: "Prebrood" },
  { value: "PLACEMENT", label: "Placement" },
  { value: "WEIGH_DAY", label: "Weigh Day" },
  { value: "VACCINATION", label: "Vaccination" },
  { value: "MEDICATION", label: "Medication" },
  { value: "EQUIPMENT_ISSUE", label: "Equipment Issue" },
  { value: "MORTALITY_INVESTIGATION", label: "Mortality Investigation" },
  { value: "PRE_CATCH", label: "Pre-Catch Visit" },
  { value: "LAST_FEED_ORDER", label: "Last Feed Order" },
  { value: "CERTIFICATION", label: "Certification" },
  { value: "OTHER", label: "Other" },
] as const;

export const VISIT_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(VISIT_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])),
  // Kept for visits saved before this type was removed from the picker.
  SEVEN_DAY: "7-day visit",
};
