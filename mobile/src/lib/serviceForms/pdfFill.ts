/**
 * Build Bachoco service PDFs: original scanned form as the page, values and
 * X-marks stamped into the printed blanks (no opaque AcroForm widgets).
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

/** Inset so field widgets sit inside cells and don't erase grid lines. */
const PAD_X = 0.22;
const PAD_Y = 0.28;

/** Convert top-left % box to pdf-lib bottom-left rect, inset from cell edges. */
function box(xPct: number, yPct: number, wPct: number, hPct: number) {
  const x = xPct + PAD_X;
  const y = yPct + PAD_Y;
  const w = Math.max(0.4, wPct - PAD_X * 2);
  const h = Math.max(0.35, hPct - PAD_Y * 2);
  return {
    x: (x / 100) * W,
    y: H - ((y + h) / 100) * H,
    width: (w / 100) * W,
    height: (h / 100) * H,
  };
}

/** Opaque white only when we must cover printed ink (continuation #, /300, N/A). */
function coverRect(page: PDFPage, xPct: number, yPct: number, wPct: number, hPct: number) {
  // No PAD inset — covers must fully erase printed glyphs at cell edges.
  page.drawRectangle({
    x: (xPct / 100) * W,
    y: H - ((yPct + hPct) / 100) * H,
    width: (wPct / 100) * W,
    height: (hPct / 100) * H,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

type TextOpts = {
  /** Skip when value is blank. */
  skipEmpty?: boolean;
  /** Paint a tight white cover under the value (continuation #, /300 timers). */
  cover?: boolean;
};

/**
 * Stamp a value onto the scan. Uses drawText (not AcroForm widgets) so pdf-lib
 * cannot paint opaque white field appearances over grid lines. Values still
 * live in the PDF content stream on the original form page.
 */
function addText(
  _form: PDFForm,
  page: PDFPage,
  _name: string,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  value: string,
  fontSize = 8,
  opts: TextOpts = {},
) {
  const skipEmpty = opts.skipEmpty !== false;
  const v = String(value ?? "").trim();
  if (skipEmpty && !v) return null;
  if (!markFont) return null;

  if (opts.cover) coverRect(page, xPct, yPct, wPct, hPct);

  // Sit text inside the cell (vertically centered-ish in the box).
  const x = ((xPct + PAD_X) / 100) * W;
  const y = H - ((yPct + hPct * 0.82) / 100) * H;
  page.drawText(v, {
    x,
    y,
    size: fontSize,
    font: markFont,
    color: rgb(0, 0, 0),
    maxWidth: (Math.max(0.5, wPct - PAD_X * 2) / 100) * W,
  });
  return null;
}

/** Write comments on the printed rules — no AcroForm box (avoids a giant white widget). */
function drawCommentLines(
  page: PDFPage,
  font: PDFFont,
  xPct: number,
  yPct: number,
  value: string,
  fontSize = 8,
  lineHPct = 2.15,
) {
  const lines = String(value ?? "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const t = line.trim();
      if (!t) return [];
      // Soft-wrap long lines (~95 chars at this size on letter width).
      const max = 95;
      if (t.length <= max) return [t];
      const out: string[] = [];
      let rest = t;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(" ", max);
        if (cut < 40) cut = max;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) out.push(rest);
      return out;
    });
  lines.slice(0, 8).forEach((line, i) => {
    const yTop = yPct + i * lineHPct;
    page.drawText(line, {
      x: (xPct / 100) * W,
      y: H - (yTop / 100) * H - fontSize * 0.35,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

/** Set before building fields — used to stamp X marks without white checkbox widgets. */
let markFont: PDFFont | null = null;

function addYesNo(
  _form: PDFForm,
  page: PDFPage,
  _name: string,
  yesX: number,
  noX: number,
  yPct: number,
  value: YesNo,
) {
  if (value === "yes") addCheck(page, yesX, yPct, true);
  else if (value === "no") addCheck(page, noX, yPct, true);
}

/** Stamp an X (no AcroForm widget — widgets paint opaque white over the scan). */
function addCheck(page: PDFPage, xPct: number, yPct: number, on: boolean) {
  if (!on || !markFont) return;
  const size = 9;
  page.drawText("X", {
    x: (xPct / 100) * W - size * 0.35,
    y: H - (yPct / 100) * H - size * 0.35,
    size,
    font: markFont,
    color: rgb(0, 0, 0),
  });
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
  rows: [11.35, 13.35, 15.4, 17.45, 19.45, 21.45, 23.5, 25.55],
  rowH: 1.7,
  ynL: { yes: 39.5, no: 46.5 },
  ynWater: { yes: 38.1, no: 45.1 },
  ynR: { yes: 88.7, no: 93.9 },
  vent: { min: 52.1, power: 59.1, tunnel: 66.2, y: 41.85 },
  /** Min vent timer row (above cool headers). */
  minVentY: 47.7,
  /** Cool-cell Degrees / value row (not the header labels). */
  coolY: 51.15,
  /** Max CFM overwrites the printed N/A cell in the Power/cool header band. */
  maxCfm: { x: 34.8, y: 49.35, w: 13.5, h: 1.35 },
  backupY: 71.0,
  backupX: [61.5, 68.5, 75.5, 82.5, 89.0] as const,
};

const PL = {
  houses: [37.27, 44.15, 51.03, 57.91, 64.8, 71.68, 78.56, 85.44],
  litterY: 37.55,
  ammoniaY: 39.15,
  cellH: 1.45,
  ynL: { yes: 37.0, no: 44.0 },
  ynR: { yes: 71.5, no: 79.0 },
  ynR2: { yes: 75.5, no: 81.5 },
  /** Top of HI/LOW cells (labels sit at the bottom of the same cells). */
  alarmY: 67.35,
  alarmHiX: 36.0,
  alarmLowX: 42.3,
  /** Backup value cells under Heat / Cool / Stage 1–3. */
  backupY: 69.2,
  backupX: [56.5, 63.5, 70.5, 77.5, 84.5] as const,
  /** Emergency yes/no row centers (below YES/NO header). */
  genY: 66.1,
  dialerY: 67.55,
};

const PB = {
  yn: { yes: 36.2, no: 43.0 },
  ammoniaX: [33.3, 40.2, 47.1, 54.0, 60.9, 67.8, 74.7, 81.6],
  ammoniaY: 37.15,
  ammoniaW: 6.0,
  ammoniaH: 1.35,
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
  font: PDFFont,
  data: ServiceReportForm,
  housesSlice: ServiceReportForm["houses"],
  opts: { pageIndex: number; continuation: boolean },
) {
  markFont = font;
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
      // Tight white cover only over the printed #, then transparent field text.
      coverRect(page, SR.cols.num, y, SR.colW.num, SR.rowH);
      if (h) {
        addText(
          form,
          page,
          `${p}.h${i}.num`,
          SR.cols.num,
          y,
          SR.colW.num,
          SR.rowH,
          String(h.houseNumber),
          8,
        );
      }
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
  addText(form, page, `${p}.lightsOn`, 63.2, 33.55, 5.5, 1.2, data.lightsOnAt, 8);
  addText(form, page, `${p}.lightsOff`, 87.2, 33.55, 7.5, 1.2, data.lightsOffAt, 8);

  addYesNo(form, page, `${p}.tempTargets`, yL, nL, 37.35, data.tempTargetsOk);
  if (data.tempTargetsOk === "no") {
    addText(form, page, `${p}.actualTarget`, 56.0, 37.0, 12, 1.3, data.actualTempTarget, 8);
    addText(form, page, `${p}.recoTarget`, 70.0, 37.0, 12, 1.3, data.recommendedTempTarget, 8);
  }
  addYesNo(form, page, `${p}.ammonia`, yL, nL, 38.9, data.ammoniaOk);
  addText(
    form,
    page,
    `${p}.humidity`,
    35.0,
    40.0,
    12.5,
    1.15,
    data.humidityPct ? `${data.humidityPct}%` : "",
    8,
  );

  addCheck(page, SR.vent.min, SR.vent.y, data.ventModes.includes("min"));
  addCheck(page, SR.vent.power, SR.vent.y, data.ventModes.includes("power"));
  addCheck(page, SR.vent.tunnel, SR.vent.y, data.ventModes.includes("tunnel"),
  );
  addText(form, page, `${p}.tunnelFans`, 91.5, 41.5, 4.5, 1.1, data.tunnelFanCount, 8);

  addCheck(page, 22.2, 45.15, data.ventDoorType === "ceiling");
  addCheck(page, 29.8, 45.15, data.ventDoorType === "sidewall");
  addText(form, page, `${p}.sp`, 35.2, 44.5, 5.8, 1.15, data.staticPressure, 8);
  addText(form, page, `${p}.ventOpen`, 42.2, 44.5, 12.5, 1.15, data.ventOpeningInches, 8);

  addText(form, page, `${p}.cfmMin`, 21.0, 46.0, 12.5, 1.15, data.cfmPerFt2MinVent, 8);
  addText(form, page, `${p}.fans`, 56.5, 46.0, 38.0, 1.15, data.fansSizeAndCount, 8);

  // Timer row — cover printed "/300" and stamp "N on / M off".
  addText(
    form,
    page,
    `${p}.minVentActual`,
    22.0,
    SR.minVentY,
    12.2,
    1.35,
    formatMinVentPair(data.minVentActualOn, data.minVentActualOff),
    6,
    { cover: true },
  );
  addText(
    form,
    page,
    `${p}.minVentReco`,
    56.5,
    SR.minVentY,
    13.0,
    1.35,
    formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff),
    6,
    { cover: true },
  );

  // Max CFM overwrites the printed N/A cell in the Power/cool header band.
  addText(
    form,
    page,
    `${p}.maxCfm`,
    SR.maxCfm.x,
    SR.maxCfm.y,
    SR.maxCfm.w,
    SR.maxCfm.h,
    data.maxCfm,
    8,
    { cover: true },
  );
  addText(form, page, `${p}.coolOff`, 49.5, SR.coolY, 8.5, 1.15, data.coolCellOffTemp, 8);
  addText(form, page, `${p}.coolOn`, 63.5, SR.coolY, 8.5, 1.15, data.coolCellOnTemp, 8);
  addText(
    form,
    page,
    `${p}.coolTimer`,
    78.0,
    SR.coolY,
    12.0,
    1.15,
    data.coolCellTimerOn || data.coolCellTimerOff
      ? `${data.coolCellTimerOn}/${data.coolCellTimerOff}`
      : "",
    8,
  );

  addYesNo(form, page, `${p}.waterLines`, yW, nW, 54.25, data.waterLinesOk);
  addYesNo(form, page, `${p}.sightTubes`, yW, nW, 55.95, data.sightTubesOk);
  addYesNo(form, page, `${p}.waterAdditive`, yW, nW, 57.65, data.waterAdditive);
  addText(form, page, `${p}.psiBefore`, 78.0, 54.15, 7.5, 1.15, data.psiBefore, 8);
  addText(form, page, `${p}.psiAfter`, 78.0, 55.85, 7.5, 1.15, data.psiAfter, 8);
  addText(form, page, `${p}.waterCol`, 35.5, 58.9, 5.5, 1.15, data.waterColumnInches, 8);
  addText(form, page, `${p}.ph`, 64.5, 58.85, 5.5, 1.1, data.ph, 8);

  addYesNo(form, page, `${p}.partitioned`, yL, nL, 62.7, data.partitionedOk);
  addYesNo(form, page, `${p}.comfortable`, yL, nL, 64.2, data.comfortableSpreadOk);
  addYesNo(form, page, `${p}.premise`, yR, nR, 62.7, data.premiseCleanOk);
  addYesNo(form, page, `${p}.rodenticide`, yR, nR, 64.2, data.rodenticideOk);
  addYesNo(form, page, `${p}.footBaths`, yR, nR, 65.7, data.footBathsOk);

  addYesNo(form, page, `${p}.generatorAuto`, yW, nW, 67.5, data.generatorAutoOk);
  addYesNo(form, page, `${p}.dialerOn`, yW, nW, 69.1, data.dialerOnOk);
  addText(form, page, `${p}.alarmHi`, 35.5, 71.3, 5.5, 1.1, data.alarmHi, 8);
  addText(form, page, `${p}.alarmLow`, 42.5, 71.3, 5.5, 1.1, data.alarmLow, 8);

  const [bH, bC, b1, b2, b3] = SR.backupX;
  const bY = SR.backupY;
  addText(form, page, `${p}.backupHeat`, bH, bY, 5.8, 1.1, data.backupHeat, 8);
  addText(form, page, `${p}.backupCool`, bC, bY, 5.8, 1.1, data.backupCool, 8);
  addText(form, page, `${p}.backupS1`, b1, bY, 5.8, 1.1, data.backupStage1, 8);
  addText(form, page, `${p}.backupS2`, b2, bY, 5.8, 1.1, data.backupStage2, 8);
  addText(form, page, `${p}.backupS3`, b3, bY, 7.5, 1.1, data.backupStage3, 8);

  drawCommentLines(page, font, 8.0, 76.0, data.comments, 8, 2.2);
  addText(form, page, `${p}.tech`, 16.0, 94.2, 40, 1.4, data.serviceTech, 10);
}

function buildPlacementFields(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  data: PlacementForm,
) {
  markFont = font;
  const p = "pl";
  const { yes: yL, no: nL } = PL.ynL;
  const { yes: yR, no: nR } = PL.ynR;
  const { yes: yR2, no: nR2 } = PL.ynR2;

  addText(form, page, `${p}.farmName`, 13.0, 9.25, 24, 1.4, data.farmName, 9);
  addText(form, page, `${p}.farmNumber`, 39.0, 9.25, 7, 1.4, data.farmNumber, 9);
  addText(form, page, `${p}.flockNumber`, 47.0, 9.25, 8, 1.4, data.flockNumber, 9);
  addText(
    form,
    page,
    `${p}.date`,
    80.0,
    9.4,
    14,
    1.4,
    formatServiceShortDate(data.date) || data.date,
    9,
  );

  addYesNo(form, page, `${p}.suppLids`, yL, nL, 13.6, data.supplementalLidsOk);
  addYesNo(form, page, `${p}.feederPaper`, yL, nL, 15.2, data.feederPaperOk);
  addYesNo(form, page, `${p}.feedTray`, yL, nL, 16.7, data.feedTrayRibsOk);
  addYesNo(form, page, `${p}.turbo`, yR, nR, 16.7, data.turboFeedersFullOk);

  addYesNo(form, page, `${p}.bulbs`, yL, nL, 20.3, data.bulbsReplacedOk);
  addYesNo(form, page, `${p}.fullIntensity`, yL, nL, 21.9, data.lightsFullIntensityOk);
  addYesNo(form, page, `${p}.callPan`, yL, nL, 23.4, data.callPanLightsOk);
  addYesNo(form, page, `${p}.broodLights`, yR2, nR2, 21.9, data.broodLightsOnOk);

  addYesNo(form, page, `${p}.tempDay1`, yL, nL, 27.1, data.tempDay1Ok);
  addYesNo(form, page, `${p}.litterAmend`, yL, nL, 28.6, data.litterAmendmentOk);
  addCheck(page, 52.5, 28.6, data.litterAmendmentType === "PLT");
  addCheck(page, 58.5, 28.6, data.litterAmendmentType === "Pure7");
  addYesNo(form, page, `${p}.heaters`, yL, nL, 30.2, data.heatersOk);
  addYesNo(form, page, `${p}.sensors`, yR2, nR2, 30.2, data.sensorsBirdLevelOk);

  addCheck(page, 37.5, 33.6, data.ventDoorType === "ceiling");
  addCheck(page, 44.5, 33.6, data.ventDoorType === "sidewall");
  addText(form, page, `${p}.sp`, 51.0, 33.1, 5, 1.3, data.staticPressure, 7);
  addText(form, page, `${p}.ventOpen`, 58.0, 33.1, 28, 1.3, data.ventOpeningInches, 7);
  addText(form, page, `${p}.cfmMin`, 37.0, 34.5, 12, 1.35, data.cfmPerFt2MinVent, 7);
  addText(form, page, `${p}.fans`, 72.0, 34.5, 16, 1.35, data.fansSizeAndCount, 7);

  const mvA = formatMinVentPair(data.minVentActualOn, data.minVentActualOff);
  const mvR = formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff);
  addText(form, page, `${p}.mvActual`, 34.0, 36.15, 14, 1.35, mvA, 6, { cover: true });
  addText(form, page, `${p}.mvReco`, 74.0, 36.15, 15, 1.35, mvR, 6, { cover: true });

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

  addYesNo(form, page, `${p}.sight`, yL, nL, 44.5, data.sightTubesOk);
  addYesNo(form, page, `${p}.proxy`, yL, nL, 46.1, data.proxyTestOk);
  addYesNo(form, page, `${p}.additive`, yL, nL, 47.7, data.waterAdditive);
  addText(form, page, `${p}.psiBefore`, 35.0, 49.0, 8, 1.3, data.psiBefore, 8);
  addText(form, page, `${p}.psiAfter`, 35.0, 50.55, 8, 1.3, data.psiAfter, 8);
  addText(form, page, `${p}.waterCol`, 35.0, 52.05, 8, 1.3, data.waterColumnInches, 8);
  addText(form, page, `${p}.ph`, 62.0, 51.95, 5.5, 1.4, data.ph, 8);

  addYesNo(form, page, `${p}.partitioned`, yL, nL, 56.0, data.partitionedOk);
  addYesNo(form, page, `${p}.premise`, yL, nL, 59.2, data.premiseCleanOk);
  addYesNo(form, page, `${p}.rodenticide`, yL, nL, 60.7, data.rodenticideOk);
  addYesNo(form, page, `${p}.footBaths`, yL, nL, 62.2, data.footBathsOk);

  addYesNo(form, page, `${p}.generatorAuto`, yL, nL, PL.genY, data.generatorAutoOk);
  addYesNo(form, page, `${p}.dialerOn`, yL, nL, PL.dialerY, data.dialerOnOk);
  addText(form, page, `${p}.alarmHi`, PL.alarmHiX, PL.alarmY, 5.0, 1.15, data.alarmHi, 8);
  addText(form, page, `${p}.alarmLow`, PL.alarmLowX, PL.alarmY, 5.0, 1.15, data.alarmLow, 8);

  const [bH, bC, b1, b2, b3] = PL.backupX;
  const bY = PL.backupY;
  addText(form, page, `${p}.backupHeat`, bH, bY, 5.5, 1.35, data.backupHeat, 8);
  addText(form, page, `${p}.backupCool`, bC, bY, 5.5, 1.35, data.backupCool, 8);
  addText(form, page, `${p}.backupS1`, b1, bY, 5.5, 1.35, data.backupStage1, 8);
  addText(form, page, `${p}.backupS2`, b2, bY, 5.5, 1.35, data.backupStage2, 8);
  addText(form, page, `${p}.backupS3`, b3, bY, 5.5, 1.35, data.backupStage3, 8);

  drawCommentLines(page, font, 8.0, 72.5, data.comments, 8, 2.2);
  addText(form, page, `${p}.tech`, 16.0, 94.6, 40, 1.4, data.serviceTech, 10);
}

function buildPrebroodFields(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  data: PrebroodForm,
) {
  markFont = font;
  const p = "pb";
  const { yes, no } = PB.yn;

  addText(form, page, `${p}.farmName`, 11.0, 9.25, 24, 1.4, data.farmName, 9);
  addText(form, page, `${p}.farmNumber`, 36.0, 9.25, 6, 1.4, data.farmNumber, 9);
  addText(form, page, `${p}.flockNumber`, 43.0, 9.25, 8, 1.4, data.flockNumber, 9);
  addText(
    form,
    page,
    `${p}.date`,
    83.0,
    9.25,
    12,
    1.4,
    formatServiceShortDate(data.date) || data.date,
    9,
  );

  if (data.windowHours === "48" || data.windowHours === "72") {
    addCheck(page, data.windowHours === "48" ? 56.7 : 63.6, 9.6, true,
    );
  }

  addYesNo(form, page, `${p}.feedDelivered`, yes, no, 13.5, data.feedDeliveredOk);
  addYesNo(form, page, `${p}.feedPaper`, yes, no, 15.0, data.feedPaperDeliveredOk);
  addYesNo(form, page, `${p}.suppLids`, yes, no, 16.6, data.supplementalLidsDeliveredOk);
  addYesNo(form, page, `${p}.bulbs`, yes, no, 20.1, data.bulbsReplacedOk);
  addYesNo(form, page, `${p}.lighting`, yes, no, 21.7, data.lightingProgramOk);

  addYesNo(form, page, `${p}.moisture`, yes, no, 25.6, data.moistureChartOk);
  addYesNo(form, page, `${p}.litterAmend`, yes, no, 27.2, data.litterAmendmentOk);
  addCheck(page, 52.0, 27.2, data.litterAmendmentType === "PLT");
  addCheck(page, 58.5, 27.2, data.litterAmendmentType === "Pure7");
  addYesNo(form, page, `${p}.minVentOn`, yes, no, 28.5, data.minVentOnOk);
  addYesNo(form, page, `${p}.fansClean`, yes, no, 30.1, data.fansCleanOk);
  addYesNo(form, page, `${p}.tempDay1`, yes, no, 31.6, data.tempDay1Ok);
  addYesNo(form, page, `${p}.cakeOut`, yes, no, 33.0, data.cakeOutOk);
  addYesNo(form, page, `${p}.cleanOut`, 77.5, 84.5, 33.0, data.cleanOutPadTreatOk);
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
  addCheck(page, 50.2, 49.95, data.insecticideType === "CV");
  addCheck(page, 57.1, 49.95, data.insecticideType === "RVO");

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

  drawCommentLines(page, font, 8.0, 65.8, data.comments, 8, 2.2);
  addText(form, page, `${p}.tech`, 16.0, 94.6, 40, 1.4, data.serviceTech, 10);
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

  buildServiceReportFields(
    pdfForm,
    doc.getPages()[0]!,
    font,
    form,
    pages[0] ?? [],
    { pageIndex: 0, continuation: false },
  );

  for (let p = 1; p < pages.length; p++) {
    const templateDoc = await loadTemplate(template);
    const [blank] = await doc.copyPages(templateDoc, [0]);
    doc.addPage(blank);
    buildServiceReportFields(
      pdfForm,
      doc.getPages()[doc.getPageCount() - 1]!,
      font,
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
  buildPlacementFields(pdfForm, doc.getPages()[0]!, font, form);
  pdfForm.updateFieldAppearances(font);
  return writePdfToCache(doc, `placement-${Date.now()}.pdf`);
}

async function buildPrebroodPdf(form: PrebroodForm) {
  const template = require("../../../../assets/service-forms/prebrood.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfForm = doc.getForm();
  buildPrebroodFields(pdfForm, doc.getPages()[0]!, font, form);
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
