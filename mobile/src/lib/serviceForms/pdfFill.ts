/**
 * Build fillable Bachoco PDFs: original form page as background + AcroForm
 * fields (text / checkboxes / radios) so values live in the PDF form, not as
 * drawText overlays.
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFForm,
  type PDFPage,
} from "pdf-lib";
import type {
  AnyServiceForm,
  PlacementForm,
  PrebroodForm,
  ServiceReportForm,
  YesNo,
} from "./types";
import { formatMinVentPair, formatServiceShortDate } from "./format";

const W = 612;
const H = 792;

/** Convert top-left % box to pdf-lib bottom-left rect. */
function box(xPct: number, yPct: number, wPct: number, hPct: number) {
  return {
    x: (xPct / 100) * W,
    y: H - ((yPct + hPct) / 100) * H,
    width: (wPct / 100) * W,
    height: (hPct / 100) * H,
  };
}

function centerCheck(xPct: number, yPct: number, sizePt = 11) {
  return {
    x: (xPct / 100) * W - sizePt / 2,
    y: H - (yPct / 100) * H - sizePt / 2,
    width: sizePt,
    height: sizePt,
  };
}

function addText(
  form: PDFForm,
  page: PDFPage,
  name: string,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  value: string,
  fontSize = 8,
) {
  const field = form.createTextField(name);
  field.addToPage(page, {
    ...box(xPct, yPct, wPct, hPct),
    borderWidth: 0,
    backgroundColor: rgb(1, 1, 1),
  });
  // Preserve a single space so empty continuation covers still paint.
  const raw = String(value ?? "");
  const v = raw.trim() === "" && raw.length > 0 ? " " : raw.trim();
  if (v) field.setText(v);
  try {
    field.setFontSize(fontSize);
  } catch {
    // Some readers pick up size from updateFieldAppearances.
  }
  return field;
}

function addMultiline(
  form: PDFForm,
  page: PDFPage,
  name: string,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  value: string,
  fontSize = 8,
) {
  const field = addText(form, page, name, xPct, yPct, wPct, hPct, value, fontSize);
  field.enableMultiline();
  return field;
}

function addYesNo(
  form: PDFForm,
  page: PDFPage,
  name: string,
  yesX: number,
  noX: number,
  yPct: number,
  value: YesNo,
) {
  // Checkboxes (checkmark) rather than radio dots — closer to paper X marks.
  addCheck(form, page, `${name}.yes`, yesX, yPct, value === "yes");
  addCheck(form, page, `${name}.no`, noX, yPct, value === "no");
}

function addCheck(
  form: PDFForm,
  page: PDFPage,
  name: string,
  xPct: number,
  yPct: number,
  on: boolean,
) {
  const cb = form.createCheckBox(name);
  cb.addToPage(page, {
    ...centerCheck(xPct, yPct),
    borderWidth: 0,
    backgroundColor: rgb(1, 1, 1),
  });
  if (on) cb.check();
  else cb.uncheck();
}

/** Service Report layout — cell left/top edges from form grid lines (top-left %). */
const SR = {
  cols: {
    num: 3.18,
    age: 5.53,
    placed: 10.71,
    weeks: [20.24, 26.29, 32.18, 38.12, 44.0, 50.06, 56.12, 62.18],
    weekW: 5.85,
    temp: 68.29,
    mort: 77.12,
    binA: 85.94,
    binB: 91.18,
  },
  colW: { num: 2.2, age: 5.0, placed: 9.3, temp: 8.6, mort: 8.6, bin: 5.0 },
  /** Top edge of each house data row. */
  rows: [11.2, 13.2, 15.25, 17.3, 19.3, 21.3, 23.35, 25.4],
  rowH: 1.85,
  ynL: { yes: 39.5, no: 46.5 },
  ynWater: { yes: 37.8, no: 48.0 },
  ynR: { yes: 88.7, no: 93.9 },
};

const PL = {
  houses: [37.27, 44.15, 51.03, 57.91, 64.8, 71.68, 78.56, 85.44],
  houseW: 6.2,
  litterY: 38.15,
  ammoniaY: 40.15,
  cellH: 1.45,
  ynL: { yes: 37.0, no: 44.0 },
  ynR: { yes: 71.5, no: 79.0 },
};

const PB = {
  yn: { yes: 36.5, no: 43.5 },
  /** Ammonia PPM cell left edges under houses #1–#8. */
  ammoniaX: [33.0, 39.94, 46.82, 53.71, 60.59, 67.47, 74.41, 81.29],
  ammoniaY: 37.05,
  ammoniaW: 5.5,
  ammoniaH: 0.95,
  /** Emergency row centers (block → hours). */
  emY: {
    blockHeater: 53.5,
    battery: 55.0,
    genTest: 56.5,
    dialer: 58.0,
    serviced: 59.6,
    hours: 61.1,
  },
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

function buildServiceReportFields(
  form: PDFForm,
  page: PDFPage,
  data: ServiceReportForm,
  housesSlice: ServiceReportForm["houses"],
  opts: { pageIndex: number; continuation: boolean },
) {
  const p = `sr.p${opts.pageIndex}`;
  const { yes: yL, no: nL } = SR.ynL;
  const { yes: yR, no: nR } = SR.ynR;
  const { yes: yW, no: nW } = SR.ynWater;

  addText(form, page, `${p}.farmName`, 20.0, 5.1, 42, 1.4, data.farmName, 10);
  addText(
    form,
    page,
    `${p}.date`,
    70.0,
    5.1,
    18,
    1.4,
    formatServiceShortDate(data.date) || data.date,
    10,
  );
  addText(form, page, `${p}.farmNumber`, 11.5, 7.9, 14, 1.5, data.farmNumber ?? "", 9);
  addText(form, page, `${p}.flockNumber`, 37.5, 7.9, 18, 1.5, data.flockNumber ?? "", 9);

  // House grid — fillable cells. On continuation pages, # fields (white) cover printed 1–8.
  for (let i = 0; i < 8; i++) {
    const y = SR.rows[i]!;
    const h = housesSlice[i];
    if (opts.continuation) {
      // Always set text (space if unused) so the white field appearance
      // covers the printed 1–8 house numbers on continuation pages.
      addText(
        form,
        page,
        `${p}.h${i}.num`,
        SR.cols.num,
        y,
        SR.colW.num,
        SR.rowH,
        h ? String(h.houseNumber) : " ",
        8,
      );
    }
    if (!h) continue;
    addText(form, page, `${p}.h${i}.age`, SR.cols.age, y, SR.colW.age, SR.rowH, h.age, 7);
    addText(form, page, `${p}.h${i}.placed`, SR.cols.placed, y, SR.colW.placed, SR.rowH, h.placed, 7);
    h.weeks.forEach((wk, wi) =>
      addText(
        form,
        page,
        `${p}.h${i}.wk${wi}`,
        SR.cols.weeks[wi]!,
        y,
        SR.cols.weekW,
        SR.rowH,
        wk,
        6,
      ),
    );
    addText(form, page, `${p}.h${i}.temp`, SR.cols.temp, y, SR.colW.temp, SR.rowH, h.currentTemp, 7);
    addText(form, page, `${p}.h${i}.mort`, SR.cols.mort, y, SR.colW.mort, SR.rowH, h.mortalityToDate, 7);
    addText(form, page, `${p}.h${i}.binA`, SR.cols.binA, y, SR.colW.bin, SR.rowH, h.binA, 7);
    addText(form, page, `${p}.h${i}.binB`, SR.cols.binB, y, SR.colW.bin, SR.rowH, h.binB, 7);
  }

  if (opts.continuation) return;

  addYesNo(form, page, `${p}.feederHeight`, yL, nL, 31.02, data.feederHeightOk);
  addYesNo(form, page, `${p}.feedingEquipment`, yL, nL, 32.63, data.feedingEquipmentOk);
  addYesNo(form, page, `${p}.feedAvailability`, yL, nL, 34.18, data.feedAvailabilityOk);

  addYesNo(form, page, `${p}.lightIntensity`, yR, nR, 30.91, data.lightIntensityOk);
  addYesNo(form, page, `${p}.lightsOperational`, yR, nR, 32.52, data.lightsOperationalOk);
  addText(form, page, `${p}.lightsOn`, 68.0, 33.5, 12, 1.3, data.lightsOnAt, 8);
  addText(form, page, `${p}.lightsOff`, 88.0, 33.5, 10, 1.3, data.lightsOffAt, 8);

  addYesNo(form, page, `${p}.tempTargets`, yL, nL, 37.85, data.tempTargetsOk);
  if (data.tempTargetsOk === "no") {
    addText(form, page, `${p}.actualTarget`, 56.0, 37.2, 12, 1.4, data.actualTempTarget, 8);
    addText(form, page, `${p}.recoTarget`, 70.0, 37.2, 12, 1.4, data.recommendedTempTarget, 8);
  }
  addYesNo(form, page, `${p}.ammonia`, yL, nL, 39.25, data.ammoniaOk);
  addText(
    form,
    page,
    `${p}.humidity`,
    16.0,
    40.3,
    10,
    1.3,
    data.humidityPct ? `${data.humidityPct}%` : "",
    8,
  );

  addCheck(form, page, `${p}.vent.min`, 56.0, 42.3, data.ventModes.includes("min"));
  addCheck(form, page, `${p}.vent.power`, 64.0, 42.3, data.ventModes.includes("power"));
  addCheck(form, page, `${p}.vent.tunnel`, 71.0, 42.3, data.ventModes.includes("tunnel"));
  addText(form, page, `${p}.tunnelFans`, 92.0, 41.7, 5, 1.3, data.tunnelFanCount, 8);

  addCheck(form, page, `${p}.door.ceiling`, 24.0, 46.05, data.ventDoorType === "ceiling");
  addCheck(form, page, `${p}.door.sidewall`, 30.0, 46.05, data.ventDoorType === "sidewall");
  addText(form, page, `${p}.sp`, 36.0, 45.4, 6, 1.4, data.staticPressure, 8);
  addText(form, page, `${p}.ventOpen`, 48.5, 45.4, 10, 1.4, data.ventOpeningInches, 8);

  addText(form, page, `${p}.cfmMin`, 26.0, 46.9, 12, 1.4, data.cfmPerFt2MinVent, 8);
  addText(form, page, `${p}.fans`, 56.0, 46.9, 30, 1.4, data.fansSizeAndCount, 8);

  // Cover /300 boxes with fillable timer fields
  addText(
    form,
    page,
    `${p}.minVentActual`,
    26.0,
    49.2,
    16,
    1.5,
    formatMinVentPair(data.minVentActualOn, data.minVentActualOff),
    7,
  );
  addText(
    form,
    page,
    `${p}.minVentReco`,
    60.0,
    49.2,
    16,
    1.5,
    formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff),
    7,
  );

  addText(form, page, `${p}.maxCfm`, 20.0, 51.3, 10, 1.4, data.maxCfm, 8);
  addText(form, page, `${p}.coolOff`, 53.0, 51.3, 8, 1.4, data.coolCellOffTemp, 8);
  addText(form, page, `${p}.coolOn`, 67.0, 51.3, 8, 1.4, data.coolCellOnTemp, 8);
  addText(
    form,
    page,
    `${p}.coolTimer`,
    82.0,
    51.3,
    10,
    1.4,
    data.coolCellTimerOn || data.coolCellTimerOff
      ? `${data.coolCellTimerOn}/${data.coolCellTimerOff}`
      : "",
    8,
  );

  addYesNo(form, page, `${p}.waterLines`, yW, nW, 55.5, data.waterLinesOk);
  addYesNo(form, page, `${p}.sightTubes`, yW, nW, 57.1, data.sightTubesOk);
  addYesNo(form, page, `${p}.waterAdditive`, yW, nW, 58.7, data.waterAdditive);
  addText(form, page, `${p}.psiBefore`, 70.0, 54.9, 8, 1.3, data.psiBefore, 8);
  addText(form, page, `${p}.psiAfter`, 70.0, 56.5, 8, 1.3, data.psiAfter, 8);
  addText(form, page, `${p}.waterCol`, 70.0, 58.9, 8, 1.3, data.waterColumnInches, 8);
  addText(form, page, `${p}.ph`, 88.0, 58.1, 6, 1.3, data.ph, 8);

  addYesNo(form, page, `${p}.partitioned`, yL, nL, 62.7, data.partitionedOk);
  addYesNo(form, page, `${p}.comfortable`, yL, nL, 64.2, data.comfortableSpreadOk);
  addYesNo(form, page, `${p}.premise`, yR, nR, 62.7, data.premiseCleanOk);
  addYesNo(form, page, `${p}.rodenticide`, yR, nR, 64.2, data.rodenticideOk);
  addYesNo(form, page, `${p}.footBaths`, yR, nR, 65.7, data.footBathsOk);

  addYesNo(form, page, `${p}.generatorAuto`, yW, nW, 69.0, data.generatorAutoOk);
  addYesNo(form, page, `${p}.dialerOn`, yW, nW, 70.5, data.dialerOnOk);
  addText(form, page, `${p}.alarmHi`, 69.0, 68.4, 6, 1.3, data.alarmHi, 8);
  addText(form, page, `${p}.alarmLow`, 77.0, 68.4, 6, 1.3, data.alarmLow, 8);
  addText(form, page, `${p}.backupHeat`, 54.0, 71.5, 7, 1.3, data.backupHeat, 8);
  addText(form, page, `${p}.backupCool`, 64.0, 71.5, 7, 1.3, data.backupCool, 8);
  addText(form, page, `${p}.backupS1`, 74.0, 71.5, 7, 1.3, data.backupStage1, 8);
  addText(form, page, `${p}.backupS2`, 84.0, 71.5, 7, 1.3, data.backupStage2, 8);
  addText(form, page, `${p}.backupS3`, 92.0, 71.5, 5, 1.3, data.backupStage3, 8);

  addMultiline(form, page, `${p}.comments`, 7.0, 74.5, 86, 18, data.comments, 8);
  addText(form, page, `${p}.tech`, 16.0, 93.8, 40, 1.5, data.serviceTech, 10);
}

function buildPlacementFields(form: PDFForm, page: PDFPage, data: PlacementForm) {
  const p = "pl";
  const { yes: yL, no: nL } = PL.ynL;
  const { yes: yR, no: nR } = PL.ynR;

  addText(form, page, `${p}.farmName`, 13.0, 8.5, 24, 1.5, data.farmName, 9);
  addText(form, page, `${p}.farmNumber`, 39.0, 8.5, 7, 1.5, data.farmNumber, 9);
  addText(form, page, `${p}.flockNumber`, 47.0, 8.5, 8, 1.5, data.flockNumber, 9);
  addText(
    form,
    page,
    `${p}.date`,
    80.0,
    8.5,
    14,
    1.5,
    formatServiceShortDate(data.date) || data.date,
    9,
  );

  addYesNo(form, page, `${p}.suppLids`, yL, nL, 13.75, data.supplementalLidsOk);
  addYesNo(form, page, `${p}.feederPaper`, yL, nL, 15.75, data.feederPaperOk);
  addYesNo(form, page, `${p}.feedTray`, yL, nL, 17.0, data.feedTrayRibsOk);
  addYesNo(form, page, `${p}.turbo`, yR, nR, 17.0, data.turboFeedersFullOk);

  addYesNo(form, page, `${p}.bulbs`, yL, nL, 21.4, data.bulbsReplacedOk);
  addYesNo(form, page, `${p}.fullIntensity`, yL, nL, 23.5, data.lightsFullIntensityOk);
  addYesNo(form, page, `${p}.callPan`, yL, nL, 25.5, data.callPanLightsOk);
  addYesNo(form, page, `${p}.broodLights`, yR, nR, 22.5, data.broodLightsOnOk);

  addYesNo(form, page, `${p}.tempDay1`, yL, nL, 27.8, data.tempDay1Ok);
  addYesNo(form, page, `${p}.litterAmend`, yL, nL, 29.6, data.litterAmendmentOk);
  addCheck(form, page, `${p}.plt`, 48.5, 29.6, data.litterAmendmentType === "PLT");
  addCheck(form, page, `${p}.pure7`, 56.0, 29.6, data.litterAmendmentType === "Pure7");
  addYesNo(form, page, `${p}.heaters`, yL, nL, 31.5, data.heatersOk);
  addYesNo(form, page, `${p}.sensors`, yR, nR, 31.5, data.sensorsBirdLevelOk);

  addCheck(form, page, `${p}.door.ceiling`, 37.5, 33.6, data.ventDoorType === "ceiling");
  addCheck(form, page, `${p}.door.sidewall`, 44.5, 33.6, data.ventDoorType === "sidewall");
  addText(form, page, `${p}.sp`, 51.0, 33.1, 5, 1.3, data.staticPressure, 7);
  addText(form, page, `${p}.ventOpen`, 58.0, 33.1, 28, 1.3, data.ventOpeningInches, 7);
  addText(form, page, `${p}.cfmMin`, 37.0, 34.8, 12, 1.3, data.cfmPerFt2MinVent, 7);
  addText(form, page, `${p}.fans`, 51.0, 34.8, 36, 1.3, data.fansSizeAndCount, 7);

  const mvA = formatMinVentPair(data.minVentActualOn, data.minVentActualOff);
  const mvR = formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff);
  // Actual timer spans houses 1–2; recommended spans the merged block to the right.
  addText(form, page, `${p}.mvActual`, 34.5, 36.2, 12, 1.3, mvA, 6);
  addText(form, page, `${p}.mvReco`, 48.0, 36.2, 38, 1.3, mvR, 6);

  const sorted = [...data.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  PL.houses.forEach((x, i) => {
    const h = sorted[i];
    addText(
      form,
      page,
      `${p}.litter.${i}`,
      x - 2.8,
      PL.litterY,
      5.5,
      PL.cellH,
      h?.litterTemp ?? "",
      7,
    );
    addText(
      form,
      page,
      `${p}.ammonia.${i}`,
      x - 2.8,
      PL.ammoniaY,
      5.5,
      PL.cellH,
      h?.ammoniaPpm ?? "",
      7,
    );
  });

  // Water / Space / Sanitation / Emergency are farm-level YES/NO (not per-house).
  addYesNo(form, page, `${p}.sight`, yL, nL, 44.5, data.sightTubesOk);
  addYesNo(form, page, `${p}.proxy`, yL, nL, 46.1, data.proxyTestOk);
  addYesNo(form, page, `${p}.additive`, yL, nL, 47.7, data.waterAdditive);
  addText(form, page, `${p}.psiBefore`, 36.0, 49.5, 8, 1.3, data.psiBefore, 8);
  addText(form, page, `${p}.psiAfter`, 36.0, 51.2, 8, 1.3, data.psiAfter, 8);
  addText(form, page, `${p}.waterCol`, 36.0, 52.9, 8, 1.3, data.waterColumnInches, 8);
  addText(form, page, `${p}.ph`, 88.0, 52.0, 6, 1.3, data.ph, 8);

  addYesNo(form, page, `${p}.partitioned`, yL, nL, 56.0, data.partitionedOk);
  addYesNo(form, page, `${p}.premise`, yL, nL, 59.2, data.premiseCleanOk);
  addYesNo(form, page, `${p}.rodenticide`, yL, nL, 60.7, data.rodenticideOk);
  addYesNo(form, page, `${p}.footBaths`, yL, nL, 62.2, data.footBathsOk);

  addYesNo(form, page, `${p}.generatorAuto`, yL, nL, 65.2, data.generatorAutoOk);
  addYesNo(form, page, `${p}.dialerOn`, yL, nL, 66.8, data.dialerOnOk);
  addText(form, page, `${p}.alarmHi`, 36.0, 68.5, 6, 1.3, data.alarmHi, 8);
  addText(form, page, `${p}.alarmLow`, 44.0, 68.5, 6, 1.3, data.alarmLow, 8);

  addText(form, page, `${p}.backupHeat`, 54.0, 69.3, 7, 1.3, data.backupHeat, 8);
  addText(form, page, `${p}.backupCool`, 64.0, 69.3, 7, 1.3, data.backupCool, 8);
  addText(form, page, `${p}.backupS1`, 74.0, 69.3, 7, 1.3, data.backupStage1, 8);
  addText(form, page, `${p}.backupS2`, 84.0, 69.3, 7, 1.3, data.backupStage2, 8);
  addText(form, page, `${p}.backupS3`, 92.0, 69.3, 5, 1.3, data.backupStage3, 8);

  addMultiline(form, page, `${p}.comments`, 7.0, 71.0, 86, 20, data.comments, 8);
  addText(form, page, `${p}.tech`, 16.0, 93.8, 40, 1.5, data.serviceTech, 10);
}

function buildPrebroodFields(form: PDFForm, page: PDFPage, data: PrebroodForm) {
  const p = "pb";
  const { yes, no } = PB.yn;

  addText(form, page, `${p}.farmName`, 11.0, 8.6, 24, 1.5, data.farmName, 9);
  addText(form, page, `${p}.farmNumber`, 36.0, 8.6, 6, 1.5, data.farmNumber, 9);
  addText(form, page, `${p}.flockNumber`, 43.0, 8.6, 8, 1.5, data.flockNumber, 9);
  addText(
    form,
    page,
    `${p}.date`,
    83.0,
    8.6,
    12,
    1.5,
    formatServiceShortDate(data.date) || data.date,
    9,
  );

  const hours = form.createRadioGroup(`${p}.window`);
  hours.addOptionToPage("48", page, {
    ...centerCheck(57.0, 9.3),
    borderWidth: 0,
    backgroundColor: rgb(1, 1, 1),
  });
  hours.addOptionToPage("72", page, {
    ...centerCheck(65.0, 9.3),
    borderWidth: 0,
    backgroundColor: rgb(1, 1, 1),
  });
  hours.select(data.windowHours);

  addYesNo(form, page, `${p}.feedDelivered`, yes, no, 13.5, data.feedDeliveredOk);
  addYesNo(form, page, `${p}.feedPaper`, yes, no, 15.0, data.feedPaperDeliveredOk);
  addYesNo(form, page, `${p}.suppLids`, yes, no, 16.6, data.supplementalLidsDeliveredOk);
  addYesNo(form, page, `${p}.bulbs`, yes, no, 20.1, data.bulbsReplacedOk);
  addYesNo(form, page, `${p}.lighting`, yes, no, 21.7, data.lightingProgramOk);

  addYesNo(form, page, `${p}.moisture`, yes, no, 25.6, data.moistureChartOk);
  addYesNo(form, page, `${p}.litterAmend`, yes, no, 27.2, data.litterAmendmentOk);
  addCheck(form, page, `${p}.plt`, 52.0, 27.2, data.litterAmendmentType === "PLT");
  addCheck(form, page, `${p}.pure7`, 58.5, 27.2, data.litterAmendmentType === "Pure7");
  addYesNo(form, page, `${p}.minVentOn`, yes, no, 28.5, data.minVentOnOk);
  addYesNo(form, page, `${p}.fansClean`, yes, no, 30.1, data.fansCleanOk);
  addYesNo(form, page, `${p}.tempDay1`, yes, no, 31.6, data.tempDay1Ok);
  addYesNo(form, page, `${p}.cakeOut`, yes, no, 33.4, data.cakeOutOk);
  addYesNo(form, page, `${p}.cleanOut`, 77.7, 84.6, 33.4, data.cleanOutPadTreatOk);
  addYesNo(form, page, `${p}.litterDepth`, yes, no, 34.6, data.litterDepthOk);
  addYesNo(form, page, `${p}.heaters`, yes, no, 36.2, data.heatersOk);

  const sorted = [...data.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  for (let i = 0; i < 8; i++) {
    addText(
      form,
      page,
      `${p}.ammonia.${i}`,
      PB.ammoniaX[i]!,
      PB.ammoniaY,
      PB.ammoniaW,
      PB.ammoniaH,
      sorted[i]?.ammoniaPpm ?? "",
      7,
    );
  }

  addYesNo(form, page, `${p}.sight`, yes, no, 42.8, data.sightTubesOk);
  addYesNo(form, page, `${p}.waterSan`, yes, no, 44.4, data.waterLinesSanitizedOk);
  addYesNo(form, page, `${p}.premise`, yes, no, 48.8, data.premiseCleanOk);
  addYesNo(form, page, `${p}.insecticide`, yes, no, 50.0, data.insecticideOk);
  addCheck(form, page, `${p}.cv`, 49.5, 50.0, data.insecticideType === "CV");
  addCheck(form, page, `${p}.rvo`, 56.5, 50.0, data.insecticideType === "RVO");

  const em = PB.emY;
  addYesNo(form, page, `${p}.blockHeater`, yes, no, em.blockHeater, data.blockHeaterOk);
  addYesNo(form, page, `${p}.battery`, yes, no, em.battery, data.batteryMaintainerOk);
  addYesNo(form, page, `${p}.genTest`, yes, no, em.genTest, data.generatorTestOk);
  addYesNo(form, page, `${p}.dialerTest`, yes, no, em.dialer, data.dialerTestOk);
  addYesNo(form, page, `${p}.genServiced`, yes, no, em.serviced, data.generatorServicedOk);
  addText(
    form,
    page,
    `${p}.genServiceDate`,
    22.0,
    em.serviced - 0.5,
    12,
    1.3,
    data.generatorServicedOk === "yes"
      ? formatServiceShortDate(data.generatorServiceDate)
      : "",
    8,
  );
  addYesNo(form, page, `${p}.genHoursLogged`, yes, no, em.hours, data.generatorHoursLoggedOk);
  addText(
    form,
    page,
    `${p}.genHours`,
    22.0,
    em.hours - 0.5,
    12,
    1.3,
    data.generatorHoursLoggedOk === "yes" ? data.generatorHours : "",
    8,
  );

  addMultiline(form, page, `${p}.comments`, 7.0, 64.5, 86, 26, data.comments, 8);
  addText(form, page, `${p}.tech`, 16.0, 93.8, 40, 1.5, data.serviceTech, 10);
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
  const pdfForm = doc.getForm();

  buildServiceReportFields(pdfForm, doc.getPages()[0]!, form, pages[0] ?? [], {
    pageIndex: 0,
    continuation: false,
  });

  for (let p = 1; p < pages.length; p++) {
    const templateDoc = await loadTemplate(template);
    const [blank] = await doc.copyPages(templateDoc, [0]);
    doc.addPage(blank);
    buildServiceReportFields(
      pdfForm,
      doc.getPages()[doc.getPageCount() - 1]!,
      form,
      pages[p]!,
      { pageIndex: p, continuation: true },
    );
  }

  pdfForm.updateFieldAppearances(font);
  return writePdfToCache(doc, `service-report-${Date.now()}.pdf`);
}

async function buildPlacementPdf(form: PlacementForm) {
  const template = require("../../../../assets/service-forms/placement.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfForm = doc.getForm();
  buildPlacementFields(pdfForm, doc.getPages()[0]!, form);
  pdfForm.updateFieldAppearances(font);
  return writePdfToCache(doc, `placement-${Date.now()}.pdf`);
}

async function buildPrebroodPdf(form: PrebroodForm) {
  const template = require("../../../../assets/service-forms/prebrood.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfForm = doc.getForm();
  buildPrebroodFields(pdfForm, doc.getPages()[0]!, form);
  pdfForm.updateFieldAppearances(font);
  return writePdfToCache(doc, `prebrood-${Date.now()}.pdf`);
}

async function writePdfToCache(doc: PDFDocument, filename: string) {
  const bytes = await doc.save({ updateFieldAppearances: true });
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
