export const MORTALITY_CAUSE_LABELS: Record<string, string> = {
  UNKNOWN: "Unknown",
  EARLY_MORTALITY: "Early mortality",
  LEG_ISSUES: "Leg issues",
  FLIP_OVER: "Flip-over",
  HEART_RELATED: "Heart-related",
  RESPIRATORY: "Respiratory",
  ENTERITIS: "Enteritis",
  COCCIDIOSIS: "Coccidiosis",
  HEAT_STRESS: "Heat stress",
  COLD_STRESS: "Cold stress",
  EQUIPMENT_ISSUE: "Equipment issue",
  SMOTHERING: "Smothering",
  PREDATOR: "Predator",
  CULL: "Cull",
  YOLK_INFECTION: "Yolk infection",
  BACTERIA: "Bacteria",
  ESCHERICHIA_COLI: "Escherichia coli",
  OTHER: "Other",
};

export const LITTER_EVENT_LABELS: Record<string, string> = {
  FULL_LITTER_CLEANOUT: "Full litter cleanout",
  PARTIAL_LITTER_CLEANOUT: "Partial litter cleanout",
  DE_CAKING: "De-caking",
  WINDROWING: "Windrowing",
  TILL: "Till",
  LITTER_TREATMENT: "Litter treatment",
  TOP_DRESSING: "Top dressing",
  COMPOST_REMOVAL: "Compost removal",
  OTHER: "Other",
};

export const FEED_TYPE_OPTIONS = ["Pre-started", "Starter", "Grower", "Finisher"] as const;

export const FEED_MILL_OPTIONS = ["Heavener", "Fort Smith"] as const;

export const PROCESSING_PLANT_OPTIONS = ["Heavener", "Stigler"] as const;

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

export const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  FEED: "Feed",
  WATER: "Water",
  VENTILATION: "Ventilation",
  COOLING_SYSTEM: "Cooling system",
  HEATING_SYSTEM: "Heating system",
  CONTROLLER: "Controller",
  ELECTRICAL: "Electrical",
  STRUCTURE: "Structure",
  BIOSECURITY: "Biosecurity",
  BIRD_HEALTH: "Bird health",
  LITTER: "Litter",
  OTHER: "Other",
};

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatPct(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
