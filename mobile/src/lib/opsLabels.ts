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

export const ISSUE_CATEGORY_OPTIONS = Object.entries(ISSUE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const ISSUE_PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export const ISSUE_STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "MONITORING", label: "Monitoring" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

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

export const LITTER_EVENT_OPTIONS = Object.entries(LITTER_EVENT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const FEED_TYPE_OPTIONS = ["Pre-started", "Starter", "Grower", "Finisher"] as const;
export const FEED_MILL_OPTIONS = ["Heavener", "Fort Smith"] as const;
