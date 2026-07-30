/**
 * Stamp filled values onto the original Bachoco form PDFs (identical paper layouts).
 * Coordinates are percent of page (origin top-left) on US Letter 612×792.
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AnyServiceForm, PlacementForm, PrebroodForm, ServiceReportForm, YesNo } from "./types";
import { formatMinVentPair, formatServiceShortDate } from "./format";

const W = 612;
const H = 792;

function pct(xPct: number, yPct: number) {
  return { x: (xPct / 100) * W, y: H - (yPct / 100) * H };
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  xPct: number,
  yPct: number,
  value: string,
  size = 8,
) {
  const v = String(value ?? "").trim();
  if (!v) return;
  const { x, y } = pct(xPct, yPct);
  page.drawText(v, {
    x,
    y: y - size * 0.35,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function cover(page: PDFPage, xPct: number, yPct: number, wPct: number, hPct: number) {
  const x = (xPct / 100) * W;
  const y = H - ((yPct + hPct) / 100) * H;
  page.drawRectangle({
    x,
    y,
    width: (wPct / 100) * W,
    height: (hPct / 100) * H,
    color: rgb(1, 1, 1),
  });
}

function markYesNo(
  page: PDFPage,
  font: PDFFont,
  yesX: number,
  noX: number,
  yPct: number,
  value: YesNo,
) {
  if (value === "yes") drawText(page, font, yesX, yPct, "X", 9);
  else if (value === "no") drawText(page, font, noX, yPct, "X", 9);
}

function markX(page: PDFPage, font: PDFFont, xPct: number, yPct: number, on: boolean) {
  if (on) drawText(page, font, xPct, yPct, "X", 9);
}

function wrapLines(text: string, width: number): string[] {
  return (text || "").split(/\n/).flatMap((line) => {
    const out: string[] = [];
    let rest = line;
    while (rest.length > width) {
      out.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    out.push(rest);
    return out;
  });
}

/** Service Report house table (measured from template grid). */
const SR = {
  cols: {
    age: 7.6,
    placed: 15.5,
    weeks: [23.27, 29.27, 35.18, 41.09, 47.09, 53.15, 59.21, 65.27],
    temp: 72.7,
    mort: 81.6,
    binA: 88.6,
    binB: 93.8,
  },
  rows: [12.07, 14.09, 16.13, 18.18, 20.18, 22.18, 24.2, 26.2],
  ynL: { yes: 39.5, no: 46.5 },
  /** Water / emergency left YES is slightly left of feed YES. */
  ynWater: { yes: 37.8, no: 48.0 },
  ynR: { yes: 88.7, no: 93.9 },
};

/** Placement house columns #1–#8 and farm-level YES/NO. */
const PL = {
  houses: [37.27, 44.15, 51.0, 57.85, 64.77, 71.68, 78.56, 85.44],
  ynL: { yes: 37.0, no: 44.0 },
  ynR: { yes: 71.5, no: 79.0 },
};

/** Prebrood YES/NO. */
const PB = {
  yn: { yes: 36.5, no: 43.5 },
};

async function loadTemplate(moduleRef: number) {
  const asset = Asset.fromModule(moduleRef);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return PDFDocument.load(raw);
}

function fillServiceReportPage(
  page: PDFPage,
  font: PDFFont,
  form: ServiceReportForm,
  housesSlice: ServiceReportForm["houses"],
  opts?: { continuation?: boolean; coverHouseNumbers?: boolean },
) {
  drawText(page, font, 20.5, 5.55, form.farmName, 10);
  drawText(page, font, 70.5, 5.55, formatServiceShortDate(form.date) || form.date, 10);
  drawText(page, font, 12.0, 8.55, form.farmNumber ?? "", 9);
  drawText(page, font, 38.0, 8.55, form.flockNumber ?? "", 9);

  housesSlice.forEach((h, i) => {
    if (i >= 8) return;
    const y = SR.rows[i]!;
    if (opts?.coverHouseNumbers) {
      cover(page, 3.3, y - 0.7, 1.6, 1.4);
      drawText(page, font, 3.5, y, String(h.houseNumber), 8);
    }
    drawText(page, font, SR.cols.age, y, h.age, 7);
    drawText(page, font, SR.cols.placed, y, h.placed, 7);
    h.weeks.forEach((wk, wi) => drawText(page, font, SR.cols.weeks[wi]!, y, wk, 6));
    drawText(page, font, SR.cols.temp, y, h.currentTemp, 7);
    drawText(page, font, SR.cols.mort, y, h.mortalityToDate, 7);
    drawText(page, font, SR.cols.binA, y, h.binA, 7);
    drawText(page, font, SR.cols.binB, y, h.binB, 7);
  });

  if (opts?.continuation) return;

  const { yes: yL, no: nL } = SR.ynL;
  const { yes: yR, no: nR } = SR.ynR;

  // FEED
  markYesNo(page, font, yL, nL, 31.02, form.feederHeightOk);
  markYesNo(page, font, yL, nL, 32.63, form.feedingEquipmentOk);
  markYesNo(page, font, yL, nL, 34.18, form.feedAvailabilityOk);

  // LIGHT
  markYesNo(page, font, yR, nR, 30.91, form.lightIntensityOk);
  markYesNo(page, font, yR, nR, 32.52, form.lightsOperationalOk);
  drawText(page, font, 68.5, 34.1, form.lightsOnAt, 8);
  drawText(page, font, 88.5, 34.1, form.lightsOffAt, 8);

  // AIR
  markYesNo(page, font, yL, nL, 37.85, form.tempTargetsOk);
  if (form.tempTargetsOk === "no") {
    drawText(page, font, 56.5, 37.85, form.actualTempTarget, 8);
    drawText(page, font, 70.5, 37.85, form.recommendedTempTarget, 8);
  }
  markYesNo(page, font, yL, nL, 39.25, form.ammoniaOk);
  if (form.humidityPct) drawText(page, font, 22.0, 40.9, `${form.humidityPct}%`, 8);

  markX(page, font, 56.0, 42.3, form.ventMode === "min");
  markX(page, font, 64.0, 42.3, form.ventMode === "power");
  markX(page, font, 71.0, 42.3, form.ventMode === "tunnel");
  if (form.ventMode === "tunnel") drawText(page, font, 93.5, 42.3, form.tunnelFanCount, 8);

  // Door-type checkbox row sits under Ceiling/Sidewall headers
  markX(page, font, 24.0, 46.05, form.ventDoorType === "ceiling");
  markX(page, font, 30.0, 46.05, form.ventDoorType === "sidewall");
  drawText(page, font, 37.0, 46.05, form.staticPressure, 8);
  drawText(page, font, 50.0, 46.05, form.ventOpeningInches, 8);

  drawText(page, font, 28.0, 47.5, form.cfmPerFt2MinVent, 8);
  drawText(page, font, 58.0, 47.5, form.fansSizeAndCount, 8);

  // Cover printed /300 inside timer boxes and write on/off pair
  cover(page, 26.0, 49.35, 14.5, 1.2);
  cover(page, 60.0, 49.35, 14.5, 1.2);
  drawText(page, font, 26.3, 50.05, formatMinVentPair(form.minVentActualOn, form.minVentActualOff), 7);
  drawText(
    page,
    font,
    60.3,
    50.05,
    formatMinVentPair(form.minVentRecommendedOn, form.minVentRecommendedOff),
    7,
  );

  drawText(page, font, 22.0, 52.0, form.maxCfm, 8);
  drawText(page, font, 54.0, 52.0, form.coolCellOffTemp, 8);
  drawText(page, font, 68.0, 52.0, form.coolCellOnTemp, 8);
  drawText(
    page,
    font,
    84.0,
    52.0,
    form.coolCellTimerOn || form.coolCellTimerOff
      ? `${form.coolCellTimerOn}/${form.coolCellTimerOff}`
      : "",
    8,
  );

  // WATER
  const { yes: yW, no: nW } = SR.ynWater;
  markYesNo(page, font, yW, nW, 55.5, form.waterLinesOk);
  markYesNo(page, font, yW, nW, 57.1, form.sightTubesOk);
  markYesNo(page, font, yW, nW, 58.7, form.waterAdditive);
  drawText(page, font, 72.0, 55.5, form.psiBefore, 8);
  drawText(page, font, 72.0, 57.1, form.psiAfter, 8);
  drawText(page, font, 72.0, 59.5, form.waterColumnInches, 8);
  drawText(page, font, 90.0, 58.7, form.ph, 8);

  // SPACE / SANITATION
  markYesNo(page, font, yL, nL, 62.7, form.partitionedOk);
  markYesNo(page, font, yL, nL, 64.2, form.comfortableSpreadOk);
  markYesNo(page, font, yR, nR, 62.7, form.premiseCleanOk);
  markYesNo(page, font, yR, nR, 64.2, form.rodenticideOk);
  markYesNo(page, font, yR, nR, 65.7, form.footBathsOk);

  // EMERGENCY
  markYesNo(page, font, yW, nW, 69.0, form.generatorAutoOk);
  markYesNo(page, font, yW, nW, 70.5, form.dialerOnOk);
  drawText(page, font, 70.5, 69.0, form.alarmHi, 8);
  drawText(page, font, 78.5, 69.0, form.alarmLow, 8);
  drawText(page, font, 56.0, 72.2, form.backupHeat, 8);
  drawText(page, font, 66.0, 72.2, form.backupCool, 8);
  drawText(page, font, 76.0, 72.2, form.backupStage1, 8);
  drawText(page, font, 86.0, 72.2, form.backupStage2, 8);
  drawText(page, font, 93.5, 72.2, form.backupStage3, 8);

  const commentYs = [76.09, 78.38, 80.75, 83.07, 85.34, 87.69, 89.95, 92.22];
  wrapLines(form.comments, 95)
    .slice(0, commentYs.length)
    .forEach((line, i) => drawText(page, font, 8.0, commentYs[i]!, line, 8));
  drawText(page, font, 18.0, 94.6, form.serviceTech, 10);
}

export async function buildServiceFormPdf(form: AnyServiceForm): Promise<string> {
  if (form.kind === "service_report") return buildServiceReportPdf(form);
  if (form.kind === "placement") return buildPlacementPdf(form);
  return buildPrebroodPdf(form);
}

async function buildServiceReportPdf(form: ServiceReportForm) {
  const template = require("../../../../assets/service-forms/service-report.pdf");
  const houses = [...form.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const pages: (typeof houses)[] = [];
  for (let i = 0; i < Math.max(houses.length, 1); i += 8) {
    pages.push(houses.slice(i, i + 8));
  }

  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  fillServiceReportPage(doc.getPages()[0]!, font, form, pages[0] ?? [], { continuation: false });

  for (let p = 1; p < pages.length; p++) {
    const templateDoc = await loadTemplate(template);
    const [blank] = await doc.copyPages(templateDoc, [0]);
    doc.addPage(blank);
    fillServiceReportPage(doc.getPages()[doc.getPageCount() - 1]!, font, form, pages[p]!, {
      continuation: true,
      coverHouseNumbers: true,
    });
  }

  return writePdfToCache(doc, `service-report-${Date.now()}.pdf`);
}

function markHousesYesNo(
  page: PDFPage,
  font: PDFFont,
  yPct: number,
  value: YesNo,
  yesOffset = -2.0,
  noOffset = 1.3,
) {
  PL.houses.forEach((x) => {
    if (value === "yes") drawText(page, font, x + yesOffset, yPct, "X", 7);
    else if (value === "no") drawText(page, font, x + noOffset, yPct, "X", 7);
  });
}

function fillPlacementPage(page: PDFPage, font: PDFFont, form: PlacementForm) {
  // Labels sit above boxes; values go inside the boxes (~9.2)
  drawText(page, font, 14.0, 9.2, form.farmName, 9);
  drawText(page, font, 40.0, 9.2, form.farmNumber, 9);
  drawText(page, font, 48.0, 9.2, form.flockNumber, 9);
  drawText(page, font, 82.0, 9.2, formatServiceShortDate(form.date) || form.date, 9);

  const { yes: yL, no: nL } = PL.ynL;
  const { yes: yR, no: nR } = PL.ynR;

  // FEED (ruler-calibrated row centers)
  markYesNo(page, font, yL, nL, 13.75, form.supplementalLidsOk);
  markYesNo(page, font, yL, nL, 15.75, form.feederPaperOk);
  markYesNo(page, font, yL, nL, 17.0, form.feedTrayRibsOk);
  markYesNo(page, font, yR, nR, 17.0, form.turboFeedersFullOk);

  // LIGHT
  markYesNo(page, font, yL, nL, 21.4, form.bulbsReplacedOk);
  markYesNo(page, font, yL, nL, 23.5, form.lightsFullIntensityOk);
  markYesNo(page, font, yL, nL, 25.5, form.callPanLightsOk);
  markYesNo(page, font, yR, nR, 22.5, form.broodLightsOnOk);

  // AIR checklist
  markYesNo(page, font, yL, nL, 27.8, form.tempDay1Ok);
  markYesNo(page, font, yL, nL, 29.6, form.litterAmendmentOk);
  if (form.litterAmendmentOk === "yes") {
    markX(page, font, 48.5, 29.6, form.litterAmendmentType === "PLT");
    markX(page, font, 56.0, 29.6, form.litterAmendmentType === "Pure7");
  }
  markYesNo(page, font, yL, nL, 31.5, form.heatersOk);
  markYesNo(page, font, yR, nR, 31.5, form.sensorsBirdLevelOk);

  // Compact on/off for narrow per-house cells
  const mvAShort =
    form.minVentActualOn || form.minVentActualOff
      ? `${form.minVentActualOn || "—"}/${form.minVentActualOff || "—"}`
      : "";
  const mvRShort =
    form.minVentRecommendedOn || form.minVentRecommendedOff
      ? `${form.minVentRecommendedOn || "—"}/${form.minVentRecommendedOff || "—"}`
      : "";
  PL.houses.forEach((x) => {
    if (mvAShort) {
      cover(page, x - 2.8, 35.9, 5.5, 1.15);
      drawText(page, font, x - 2.5, 36.5, mvAShort, 5);
    }
    if (mvRShort) {
      cover(page, x - 2.8, 37.4, 5.5, 1.15);
      drawText(page, font, x - 2.5, 38.0, mvRShort, 5);
    }
  });

  const sorted = [...form.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  sorted.slice(0, 8).forEach((h, i) => {
    const x = PL.houses[i]!;
    drawText(page, font, x - 1.2, 39.9, h.litterTemp, 7);
    drawText(page, font, x - 1.2, 42.5, h.ammoniaPpm, 7);
  });

  // WATER / SPACE / SAN / EMERG — paper form is per-house; stamp all columns
  markHousesYesNo(page, font, 45.0, form.sightTubesOk);
  markHousesYesNo(page, font, 46.55, form.proxyTestOk);
  markHousesYesNo(page, font, 48.4, form.waterAdditive);
  PL.houses.forEach((x) => {
    drawText(page, font, x - 1.2, 51.2, form.psiBefore, 6);
    drawText(page, font, x - 1.2, 52.8, form.psiAfter, 6);
    drawText(page, font, x - 1.2, 54.5, form.waterColumnInches, 6);
  });
  drawText(page, font, 90.0, 54.5, form.ph, 8);

  markHousesYesNo(page, font, 56.4, form.partitionedOk);
  markHousesYesNo(page, font, 59.6, form.premiseCleanOk);
  markHousesYesNo(page, font, 61.1, form.rodenticideOk);
  markHousesYesNo(page, font, 62.1, form.footBathsOk);
  markHousesYesNo(page, font, 65.1, form.generatorAutoOk);
  markHousesYesNo(page, font, 66.7, form.dialerOnOk);
  PL.houses.forEach((x) => {
    drawText(page, font, x - 2.0, 68.7, form.alarmHi, 6);
    drawText(page, font, x + 0.8, 68.7, form.alarmLow, 6);
  });

  drawText(page, font, 56.0, 70.0, form.backupHeat, 8);
  drawText(page, font, 66.0, 70.0, form.backupCool, 8);
  drawText(page, font, 76.0, 70.0, form.backupStage1, 8);
  drawText(page, font, 86.0, 70.0, form.backupStage2, 8);
  drawText(page, font, 93.5, 70.0, form.backupStage3, 8);

  const cys = [71.2, 73.18, 75.72, 78.22, 80.5, 82.78, 85.03, 87.25, 89.5, 91.78];
  wrapLines(form.comments, 95)
    .slice(0, cys.length)
    .forEach((line, i) => drawText(page, font, 8.0, cys[i]!, line, 8));
  drawText(page, font, 18.0, 94.5, form.serviceTech, 10);
}

async function buildPlacementPdf(form: PlacementForm) {
  const template = require("../../../../assets/service-forms/placement.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  fillPlacementPage(doc.getPages()[0]!, font, form);
  return writePdfToCache(doc, `placement-${Date.now()}.pdf`);
}

function fillPrebroodPage(page: PDFPage, font: PDFFont, form: PrebroodForm) {
  drawText(page, font, 12.0, 9.3, form.farmName, 9);
  drawText(page, font, 37.0, 9.3, form.farmNumber, 9);
  drawText(page, font, 44.0, 9.3, form.flockNumber, 9);
  drawText(page, font, 85.0, 9.3, formatServiceShortDate(form.date) || form.date, 9);
  // 48 Hour checkbox is left of 72 Hour
  markX(page, font, 57.0, 9.3, form.windowHours === "48");
  markX(page, font, 65.0, 9.3, form.windowHours === "72");

  const { yes, no } = PB.yn;

  markYesNo(page, font, yes, no, 13.5, form.feedDeliveredOk);
  markYesNo(page, font, yes, no, 15.0, form.feedPaperDeliveredOk);
  markYesNo(page, font, yes, no, 16.6, form.supplementalLidsDeliveredOk);

  markYesNo(page, font, yes, no, 20.1, form.bulbsReplacedOk);
  markYesNo(page, font, yes, no, 21.7, form.lightingProgramOk);

  markYesNo(page, font, yes, no, 25.6, form.moistureChartOk);
  markYesNo(page, font, yes, no, 27.2, form.litterAmendmentOk);
  if (form.litterAmendmentOk === "yes") {
    markX(page, font, 52.0, 27.2, form.litterAmendmentType === "PLT");
    markX(page, font, 58.5, 27.2, form.litterAmendmentType === "Pure7");
  }
  markYesNo(page, font, yes, no, 28.5, form.minVentOnOk);
  markYesNo(page, font, yes, no, 30.1, form.fansCleanOk);
  markYesNo(page, font, yes, no, 31.6, form.tempDay1Ok);
  markYesNo(page, font, yes, no, 33.4, form.cakeOutOk);
  if (form.cleanOutPadTreatOk === "yes") drawText(page, font, 74.0, 32.8, "X", 8);
  else if (form.cleanOutPadTreatOk === "no") drawText(page, font, 81.5, 32.8, "X", 8);
  markYesNo(page, font, yes, no, 34.6, form.litterDepthOk);
  markYesNo(page, font, yes, no, 36.2, form.heatersOk);

  const sorted = [...form.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  // Ammonia boxes #1–#8 under Current Ammonia Level
  sorted.slice(0, 8).forEach((h, i) => {
    drawText(page, font, 14 + i * 9.5, 39.5, h.ammoniaPpm, 7);
  });

  markYesNo(page, font, yes, no, 42.8, form.sightTubesOk);
  markYesNo(page, font, yes, no, 44.4, form.waterLinesSanitizedOk);

  markYesNo(page, font, yes, no, 48.8, form.premiseCleanOk);
  markYesNo(page, font, yes, no, 50.0, form.insecticideOk);
  if (form.insecticideOk === "yes") {
    markX(page, font, 58.0, 50.0, form.insecticideType === "CV");
    markX(page, font, 68.0, 50.0, form.insecticideType === "RVO");
  }

  markYesNo(page, font, yes, no, 56.7, form.blockHeaterOk);
  markYesNo(page, font, yes, no, 57.8, form.batteryMaintainerOk);
  markYesNo(page, font, yes, no, 58.6, form.generatorTestOk);
  markYesNo(page, font, yes, no, 59.9, form.dialerTestOk);
  markYesNo(page, font, yes, no, 61.3, form.generatorServicedOk);
  if (form.generatorServicedOk === "yes") {
    drawText(page, font, 55.0, 61.3, formatServiceShortDate(form.generatorServiceDate), 8);
  }
  markYesNo(page, font, yes, no, 63.1, form.generatorHoursLoggedOk);
  if (form.generatorHoursLoggedOk === "yes") {
    drawText(page, font, 55.0, 63.1, form.generatorHours, 8);
  }

  const cys = [65.39, 67.8, 70.18, 72.55, 74.94, 77.32, 79.68, 82.05, 84.32, 86.55, 88.8, 91.05];
  wrapLines(form.comments, 95)
    .slice(0, cys.length)
    .forEach((line, i) => drawText(page, font, 8.0, cys[i]!, line, 8));
  drawText(page, font, 18.0, 94.5, form.serviceTech, 10);
}

async function buildPrebroodPdf(form: PrebroodForm) {
  const template = require("../../../../assets/service-forms/prebrood.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  fillPrebroodPage(doc.getPages()[0]!, font, form);
  return writePdfToCache(doc, `prebrood-${Date.now()}.pdf`);
}

async function writePdfToCache(doc: PDFDocument, filename: string) {
  const bytes = await doc.save();
  const base64 =
    typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("base64") : uint8ToBase64(bytes);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
