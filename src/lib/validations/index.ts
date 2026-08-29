import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const farmSchema = z.object({
  farmName: z.string().min(1, "Farm name is required"),
  growerName: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().email("Enter a valid email").nullable().optional(),
  ),
  notes: z.string().optional().nullable(),
  numberOfGenerators: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  }, z.coerce.number().int().min(1).max(4).nullable().optional()),
});

export const createFarmSchema = farmSchema.extend({
  numberOfHouses: z.coerce
    .number()
    .int()
    .min(0, "Number of houses cannot be negative")
    .max(40, "Enter at most 40 houses"),
});

export const houseSchema = z.object({
  houseNumber: z.coerce.number().int().positive(),
  squareFootage: z.coerce.number().positive("Square footage must be greater than zero"),
  totalFanCFM: z.coerce.number().min(0, "Total CFM cannot be negative").optional().nullable(),
  numberOfFans: z.coerce.number().int().optional().nullable(),
  coolingPadSquareFootage: z.coerce.number().optional().nullable(),
  controllerType: z.string().optional().nullable(),
  yearBuilt: z.coerce.number().int().optional().nullable(),
  minVentilationCFM: z.coerce.number().optional().nullable(),
  fanCycleOnSeconds: z.coerce.number().int().optional().nullable(),
  fanCycleOffSeconds: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const flockSchema = z
  .object({
    flockNumber: z.string().min(1),
    flockName: z.string().optional().nullable(),
    placementDate: z.string().min(1),
    projectedCatchDate: z.string().optional().nullable(),
    actualCatchDate: z.string().optional().nullable(),
    processingPlant: z.string().optional().nullable(),
    birdType: z.string().optional().nullable(),
    sex: z.enum(["MALE", "FEMALE", "STRAIGHT_RUN", "UNKNOWN"]),
    initialBirdCount: z.coerce.number().int().min(0, "Placement count cannot be negative"),
    flockStatus: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
    targetMarketAge: z.coerce.number().int().optional().nullable(),
    targetMarketWeight: z.coerce.number().optional().nullable(),
    litterConditionAtPlacement: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    housePlacements: z
      .array(
        z.object({
          houseId: z.string(),
          placedBirdCount: z.coerce.number().int().min(0),
          processingPlant: z.string().optional().nullable(),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.actualCatchDate) return true;
      return new Date(data.actualCatchDate) >= new Date(data.placementDate);
    },
    { message: "Catch date cannot be before placement date", path: ["actualCatchDate"] },
  );

export const mortalityHouseEntrySchema = z.object({
  houseFlockId: z.string(),
  dailyMortalityCount: z.coerce.number().int().min(0, "Mortality cannot be negative"),
  cullCount: z.coerce.number().int().min(0, "Culls cannot be negative"),
  mortalityCause: z.enum([
    "UNKNOWN",
    "EARLY_MORTALITY",
    "LEG_ISSUES",
    "FLIP_OVER",
    "HEART_RELATED",
    "RESPIRATORY",
    "ENTERITIS",
    "COCCIDIOSIS",
    "HEAT_STRESS",
    "COLD_STRESS",
    "EQUIPMENT_ISSUE",
    "SMOTHERING",
    "PREDATOR",
    "CULL",
    "YOLK_INFECTION",
    "BACTERIA",
    "ESCHERICHIA_COLI",
    "OTHER",
  ]),
  comments: z.string().optional().nullable(),
  isDraft: z.boolean().optional(),
});

export const mortalityBatchSchema = z.object({
  flockId: z.string(),
  mortalityDate: z.string().min(1),
  entries: z.array(mortalityHouseEntrySchema).min(1),
});

export const mortalityHouseSeriesEntrySchema = z.object({
  mortalityDate: z.string().min(1),
  dailyMortalityCount: z.coerce.number().int().min(0, "Mortality cannot be negative"),
  cullCount: z.coerce.number().int().min(0, "Culls cannot be negative"),
});

export const mortalityHouseSeriesSchema = z
  .object({
    flockId: z.string(),
    houseFlockId: z.string(),
    mortalityCause: mortalityHouseEntrySchema.shape.mortalityCause,
    comments: z.string().optional().nullable(),
    isDraft: z.boolean().optional(),
    entries: z.array(mortalityHouseSeriesEntrySchema).default([]),
    /** Dates the tech cleared — remove confirmed entries so the day shows as missing again. */
    clearDates: z.array(z.string()).optional().default([]),
  })
  .refine((d) => d.entries.length > 0 || (d.clearDates?.length ?? 0) > 0, {
    message: "Nothing to save",
  });

export const feedDeliverySchema = z.object({
  flockId: z.string().optional().nullable(),
  houseFlockId: z.string().min(1, "Select a house"),
  deliveryDate: z.string().min(1),
  feedType: z.string().optional().nullable(),
  feedMill: z.string().optional().nullable(),
  ticketNumber: z.string().optional().nullable(),
  poundsDelivered: z.coerce.number().min(0, "Feed delivery amounts cannot be negative"),
  notes: z.string().optional().nullable(),
});

export const litterEventSchema = z.object({
  farmId: z.string(),
  houseId: z.string().optional().nullable(),
  eventDate: z.string().min(1),
  eventType: z.enum([
    "FULL_LITTER_CLEANOUT",
    "PARTIAL_LITTER_CLEANOUT",
    "DE_CAKING",
    "WINDROWING",
    "TILL",
    "LITTER_TREATMENT",
    "TOP_DRESSING",
    "COMPOST_REMOVAL",
    "OTHER",
  ]),
  litterDepth: z.coerce.number().optional().nullable(),
  contractor: z.string().optional().nullable(),
  cost: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const farmVisitSchema = z.object({
  farmId: z.string(),
  flockId: z.string().optional().nullable(),
  visitDate: z.string().min(1),
  birdAgeInDays: z.coerce.number().int().optional().nullable(),
  visitType: z.enum([
    "ROUTINE_SERVICE",
    "PLACEMENT",
    "SEVEN_DAY",
    "WEIGH_DAY",
    "VACCINATION",
    "MEDICATION",
    "EQUIPMENT_ISSUE",
    "MORTALITY_INVESTIGATION",
    "PRE_CATCH",
    "OTHER",
  ]),
  generalBirdCondition: z.string().optional().nullable(),
  activityLevel: z.string().optional().nullable(),
  uniformity: z.string().optional().nullable(),
  litterCondition: z.string().optional().nullable(),
  waterConsumption: z.string().optional().nullable(),
  feedInventory: z.string().optional().nullable(),
  temperature: z.coerce.number().optional().nullable(),
  humidity: z.coerce.number().optional().nullable(),
  staticPressure: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().optional().nullable(),
});

export const farmIssueSchema = z.object({
  farmId: z.string(),
  houseId: z.string().optional().nullable(),
  flockId: z.string().optional().nullable(),
  dateReported: z.string().min(1),
  category: z.enum([
    "FEED",
    "WATER",
    "VENTILATION",
    "COOLING_SYSTEM",
    "HEATING_SYSTEM",
    "CONTROLLER",
    "ELECTRICAL",
    "STRUCTURE",
    "BIOSECURITY",
    "BIRD_HEALTH",
    "LITTER",
    "OTHER",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(1),
  correctiveAction: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  status: z.enum(["OPEN", "MONITORING", "SCHEDULED", "RESOLVED"]),
  resolvedDate: z.string().optional().nullable(),
});

export const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  dailyMortalityWarningPct: z.coerce.number().min(0),
  dailyMortalityCriticalPct: z.coerce.number().min(0),
  sevenDayMortalityWarningPct: z.coerce.number().min(0),
  sevenDayMortalityCriticalPct: z.coerce.number().min(0),
  alertRisingThreeDays: z.boolean(),
  missingMortalityAlertTime: z.string().optional(),
  preferredUnits: z.enum(["IMPERIAL", "METRIC"]).optional(),
  defaultMarketAgeDays: z.coerce.number().int().positive(),
  notifyEmail: z.boolean(),
  notifyInApp: z.boolean(),
  farmOrder: z.enum(["age_desc", "age_asc", "name_asc", "name_desc"]).optional(),
});

export const performanceSchema = z.object({
  houseFlockId: z.string(),
  marketAgeInDays: z.coerce.number().int().optional().nullable(),
  averageLiveWeight: z.coerce.number().optional().nullable(),
  totalLiveWeight: z.coerce.number().optional().nullable(),
  feedConversion: z.coerce.number().optional().nullable(),
  adjustedFeedConversion: z.coerce.number().optional().nullable(),
  livabilityPercentage: z.coerce.number().optional().nullable(),
  mortalityPercentage: z.coerce.number().optional().nullable(),
  condemnationPercentage: z.coerce.number().optional().nullable(),
  settlementDate: z.string().optional().nullable(),
  settlementNotes: z.string().optional().nullable(),
});

export const flockSettlementSchema = z.object({
  flockId: z.string().min(1, "Select a farm with a flock"),
  marketAge: z.coerce.number().int().positive().optional().nullable(),
  breed: z.string().optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  growthRate: z.coerce.number().positive().optional().nullable(),
  feedConversion: z.coerce.number().positive().optional().nullable(),
  adjustedFeedConversion: z.coerce.number().positive().optional().nullable(),
  goodPoundsSold: z.coerce.number().min(0).optional().nullable(),
  /** Farm place/rank on settlement (1, 2, 3…). */
  settlementNo: z.coerce.number().int().min(1).optional().nullable(),
});

export const lastFeedOrderHouseInventorySchema = z.object({
  houseId: z.string().min(1),
  binAPounds: z.coerce.number().min(0, "Bin A cannot be negative"),
  binBPounds: z.coerce.number().min(0, "Bin B cannot be negative"),
  feedUpAt: z.string().optional().nullable(),
});

export const lastFeedOrderSchema = z.object({
  orderDate: z.string().min(1, "Order date is required"),
  consumptionRate: z.coerce
    .number()
    .positive("Consumption rate must be greater than zero")
    .default(0.45),
  notes: z.string().optional().nullable(),
  houseInventories: z
    .array(lastFeedOrderHouseInventorySchema)
    .min(1, "Add inventory for at least one house"),
});

export const generatorLogSchema = z.object({
  farmId: z.string().min(1),
  logDate: z.string().min(1, "Date is required"),
  gen1Hours: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  }, z.coerce.number().min(0, "Gen 1 hours cannot be negative").nullable()),
  gen2Hours: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  }, z.coerce.number().min(0, "Gen 2 hours cannot be negative").nullable()),
  gen3Hours: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  }, z.coerce.number().min(0, "Gen 3 hours cannot be negative").nullable()),
  gen4Hours: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    return v;
  }, z.coerce.number().min(0, "Gen 4 hours cannot be negative").nullable()),
});
