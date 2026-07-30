export type YesNo = "yes" | "no" | "";

export type ServiceFormKind = "service_report" | "placement" | "prebrood";

export type ServiceHouseRow = {
  houseNumber: number;
  age: string;
  placed: string;
  weeks: string[]; // Wk1–8
  currentTemp: string;
  mortalityToDate: string;
  binA: string;
  binB: string;
  litterTemp: string;
  ammoniaPpm: string;
};

export type ServiceReportForm = {
  kind: "service_report";
  farmName: string;
  date: string; // YYYY-MM-DD
  serviceTech: string;
  houses: ServiceHouseRow[];
  // Feed
  feederHeightOk: YesNo;
  feedingEquipmentOk: YesNo;
  feedAvailabilityOk: YesNo;
  // Light
  lightIntensityOk: YesNo;
  lightsOperationalOk: YesNo;
  lightsOnAt: string; // HH:mm
  lightsOffAt: string;
  // Air
  tempTargetsOk: YesNo;
  actualTempTarget: string;
  recommendedTempTarget: string;
  ammoniaOk: YesNo;
  humidityPct: string; // "" or "0"…"100"
  ventMode: "" | "min" | "power" | "tunnel";
  tunnelFanCount: string;
  ventDoorType: "" | "ceiling" | "sidewall";
  ventOpeningInches: string;
  staticPressure: string;
  cfmPerFt2MinVent: string;
  fansSizeAndCount: string;
  minVentActualOn: string;
  minVentActualOff: string;
  minVentRecommendedWeek: number;
  minVentRecommendedOn: string;
  minVentRecommendedOff: string;
  maxCfm: string;
  coolCellOffTemp: string;
  coolCellOnTemp: string;
  coolCellTimerOn: string;
  coolCellTimerOff: string;
  // Water
  waterLinesOk: YesNo;
  sightTubesOk: YesNo;
  waterAdditive: YesNo;
  waterColumnInches: string;
  psiBefore: string;
  psiAfter: string;
  ph: string;
  // Space
  partitionedOk: YesNo;
  comfortableSpreadOk: YesNo;
  // Sanitation
  premiseCleanOk: YesNo;
  rodenticideOk: YesNo;
  footBathsOk: YesNo;
  // Emergency
  generatorAutoOk: YesNo;
  dialerOnOk: YesNo;
  alarmHi: string;
  alarmLow: string;
  backupHeat: string;
  backupCool: string;
  backupStage1: string;
  backupStage2: string;
  backupStage3: string;
  comments: string;
};

export type PlacementForm = {
  kind: "placement";
  farmName: string;
  farmNumber: string;
  flockNumber: string;
  date: string;
  serviceTech: string;
  // Feed
  supplementalLidsOk: YesNo;
  feederPaperOk: YesNo;
  feedTrayRibsOk: YesNo;
  turboFeedersFullOk: YesNo;
  // Light
  bulbsReplacedOk: YesNo;
  lightsFullIntensityOk: YesNo;
  callPanLightsOk: YesNo;
  broodLightsOnOk: YesNo;
  // Air
  tempDay1Ok: YesNo;
  litterAmendmentOk: YesNo;
  litterAmendmentType: "" | "PLT" | "Pure7";
  heatersOk: YesNo;
  sensorsBirdLevelOk: YesNo;
  ventDoorType: "" | "ceiling" | "sidewall";
  ventOpeningInches: string;
  staticPressure: string;
  cfmPerFt2MinVent: string;
  fansSizeAndCount: string;
  minVentActualOn: string;
  minVentActualOff: string;
  minVentRecommendedOn: string;
  minVentRecommendedOff: string;
  houses: ServiceHouseRow[];
  // Water
  sightTubesOk: YesNo;
  proxyTestOk: YesNo;
  waterAdditive: YesNo;
  psiBefore: string;
  psiAfter: string;
  waterColumnInches: string;
  ph: string;
  // Space / Sanitation / Emergency
  partitionedOk: YesNo;
  premiseCleanOk: YesNo;
  rodenticideOk: YesNo;
  footBathsOk: YesNo;
  generatorAutoOk: YesNo;
  dialerOnOk: YesNo;
  alarmHi: string;
  alarmLow: string;
  backupHeat: string;
  backupCool: string;
  backupStage1: string;
  backupStage2: string;
  backupStage3: string;
  comments: string;
};

export type PrebroodForm = {
  kind: "prebrood";
  farmName: string;
  farmNumber: string;
  flockNumber: string;
  date: string;
  serviceTech: string;
  windowHours: "48" | "72";
  // Feed
  feedDeliveredOk: YesNo;
  feedPaperDeliveredOk: YesNo;
  supplementalLidsDeliveredOk: YesNo;
  // Light
  bulbsReplacedOk: YesNo;
  lightingProgramOk: YesNo;
  // Air
  moistureChartOk: YesNo;
  litterAmendmentOk: YesNo;
  litterAmendmentType: "" | "PLT" | "Pure7";
  minVentOnOk: YesNo;
  fansCleanOk: YesNo;
  tempDay1Ok: YesNo;
  cakeOutOk: YesNo;
  cleanOutPadTreatOk: YesNo;
  litterDepthOk: YesNo;
  heatersOk: YesNo;
  houses: ServiceHouseRow[];
  // Water
  sightTubesOk: YesNo;
  waterLinesSanitizedOk: YesNo;
  // Sanitation
  premiseCleanOk: YesNo;
  insecticideOk: YesNo;
  insecticideType: "" | "CV" | "RVO";
  // Emergency
  blockHeaterOk: YesNo;
  batteryMaintainerOk: YesNo;
  generatorTestOk: YesNo;
  dialerTestOk: YesNo;
  generatorServicedOk: YesNo;
  generatorServiceDate: string; // YYYY-MM-DD when serviced
  generatorHoursLoggedOk: YesNo;
  generatorHours: string;
  comments: string;
};

export type AnyServiceForm = ServiceReportForm | PlacementForm | PrebroodForm;
