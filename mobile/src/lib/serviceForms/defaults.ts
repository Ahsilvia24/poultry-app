import { getServiceTech } from "../appSettings";
import { todayKey } from "../ids";
import type {
  PlacementForm,
  PrebroodForm,
  ServiceHouseRow,
  ServiceReportForm,
} from "./types";

export function emptyHouseRow(houseNumber: number): ServiceHouseRow {
  return {
    houseNumber,
    age: "",
    placed: "",
    weeks: ["", "", "", "", "", "", "", ""],
    currentTemp: "",
    mortalityToDate: "",
    binA: "",
    binB: "",
    litterTemp: "",
    ammoniaPpm: "",
  };
}

export function createServiceReportDraft(input?: {
  farmName?: string;
  farmNumber?: string;
  flockNumber?: string;
  serviceTech?: string;
  houses?: ServiceHouseRow[];
}): ServiceReportForm {
  return {
    kind: "service_report",
    farmName: input?.farmName ?? "",
    farmNumber: input?.farmNumber ?? "",
    flockNumber: input?.flockNumber ?? "",
    date: todayKey(),
    serviceTech: input?.serviceTech ?? getServiceTech(),
    houses: input?.houses?.length ? input.houses : [],
    feederHeightOk: "yes",
    feedingEquipmentOk: "yes",
    feedAvailabilityOk: "yes",
    lightIntensityOk: "yes",
    lightsOperationalOk: "yes",
    lightsOnAt: "",
    lightsOffAt: "",
    tempTargetsOk: "yes",
    actualTempTarget: "",
    recommendedTempTarget: "",
    ammoniaOk: "yes",
    humidityPct: "",
    ventModes: [],
    tunnelFanCount: "",
    ventDoorTypes: [],
    ventOpeningInches: "",
    staticPressure: "",
    cfmPerFt2MinVent: "",
    fansSizeAndCount: "",
    minVentActualOn: "",
    minVentActualOff: "",
    minVentRecommendedWeek: 1,
    minVentRecommendedOn: "",
    minVentRecommendedOff: "",
    maxCfm: "",
    coolCellOffTemp: "",
    coolCellOnTemp: "",
    coolCellTimerOn: "",
    coolCellTimerOff: "",
    waterLinesOk: "yes",
    sightTubesOk: "yes",
    waterAdditive: "no",
    waterColumnInches: "",
    psiBefore: "",
    psiAfter: "",
    ph: "",
    partitionedOk: "yes",
    comfortableSpreadOk: "yes",
    premiseCleanOk: "yes",
    rodenticideOk: "yes",
    footBathsOk: "yes",
    generatorAutoOk: "yes",
    dialerOnOk: "yes",
    alarmHi: "",
    alarmLow: "",
    backupHeat: "",
    backupCool: "",
    backupStage1: "",
    backupStage2: "",
    backupStage3: "",
    comments: "",
  };
}

export function createPlacementDraft(input?: {
  farmName?: string;
  farmNumber?: string;
  flockNumber?: string;
  serviceTech?: string;
  houses?: ServiceHouseRow[];
}): PlacementForm {
  return {
    kind: "placement",
    farmName: input?.farmName ?? "",
    farmNumber: input?.farmNumber ?? "",
    flockNumber: input?.flockNumber ?? "",
    date: todayKey(),
    serviceTech: input?.serviceTech ?? getServiceTech(),
    supplementalLidsOk: "yes",
    feederPaperOk: "yes",
    feedTrayRibsOk: "yes",
    turboFeedersFullOk: "yes",
    bulbsReplacedOk: "yes",
    lightsFullIntensityOk: "yes",
    callPanLightsOk: "yes",
    broodLightsOnOk: "yes",
    tempDay1Ok: "yes",
    litterAmendmentOk: "yes",
    litterAmendmentType: "",
    heatersOk: "yes",
    sensorsBirdLevelOk: "yes",
    ventDoorTypes: [],
    ventOpeningInches: "",
    staticPressure: "",
    cfmPerFt2MinVent: "",
    fansSizeAndCount: "",
    minVentActualOn: "",
    minVentActualOff: "",
    minVentRecommendedWeek: 1,
    minVentRecommendedOn: "",
    minVentRecommendedOff: "",
    houses: input?.houses?.length ? input.houses : [],
    sightTubesOk: "yes",
    proxyTestOk: "yes",
    waterAdditive: "no",
    psiBefore: "",
    psiAfter: "",
    waterColumnInches: "",
    ph: "",
    partitionedOk: "yes",
    premiseCleanOk: "yes",
    rodenticideOk: "yes",
    footBathsOk: "yes",
    generatorAutoOk: "yes",
    dialerOnOk: "yes",
    alarmHi: "",
    alarmLow: "",
    backupHeat: "",
    backupCool: "",
    backupStage1: "",
    backupStage2: "",
    backupStage3: "",
    comments: "",
  };
}

export function createPrebroodDraft(input?: {
  farmName?: string;
  farmNumber?: string;
  flockNumber?: string;
  serviceTech?: string;
  houses?: ServiceHouseRow[];
}): PrebroodForm {
  return {
    kind: "prebrood",
    farmName: input?.farmName ?? "",
    farmNumber: input?.farmNumber ?? "",
    flockNumber: input?.flockNumber ?? "",
    date: todayKey(),
    serviceTech: input?.serviceTech ?? getServiceTech(),
    windowHours: "48",
    feedDeliveredOk: "yes",
    feedPaperDeliveredOk: "yes",
    supplementalLidsDeliveredOk: "yes",
    bulbsReplacedOk: "yes",
    lightingProgramOk: "yes",
    moistureChartOk: "yes",
    litterAmendmentOk: "yes",
    litterAmendmentType: "",
    minVentOnOk: "yes",
    fansCleanOk: "yes",
    tempDay1Ok: "yes",
    cakeOutOk: "yes",
    cleanOutPadTreatOk: "no",
    litterDepthOk: "yes",
    heatersOk: "yes",
    houses: input?.houses?.length ? input.houses : [],
    sightTubesOk: "yes",
    waterLinesSanitizedOk: "yes",
    premiseCleanOk: "yes",
    insecticideOk: "yes",
    insecticideType: "",
    blockHeaterOk: "yes",
    batteryMaintainerOk: "yes",
    generatorTestOk: "yes",
    dialerTestOk: "yes",
    generatorServicedOk: "yes",
    generatorServiceDate: "",
    comments: "",
  };
}
