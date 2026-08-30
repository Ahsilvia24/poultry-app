/**
 * Build Bachoco service PDFs by stamping values onto the original scanned
 * templates. Field positions come from a fillable AcroForm map (JSON), so the
 * shared PDF has no widget borders — only the printed form grid + stamped ink.
 */
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  AnyServiceForm,
  PlacementForm,
  PrebroodForm,
  ServiceHouseRow,
  ServiceReportForm,
  YesNo,
} from "./types";
import { formatMinVentPair, formatServiceShortDate } from "./format";
import { minVentCenteredX, minVentSideBoxes } from "./minVentLabel";

type FieldWidget = {
  x: number;
  y: number;
  w: number;
  h: number;
  samePage?: boolean;
};

type FieldMap = {
  page: { width: number; height: number };
  fields: Record<string, { type: string; widgets: FieldWidget[] }>;
};

type StampOpts = {
  widgetIndex?: number;
  xPad?: number;
  /** Extra baseline lift (pts) — positive scoots text up in the box. */
  yNudge?: number;
  /** White-out the whole widget rect (e.g. printed "/" under placement timers). */
  coverPrinted?: "field";
};

type Ctx = {
  page: PDFPage;
  font: PDFFont;
  map: FieldMap;
};

function widgetRect(map: FieldMap, name: string, index = 0): FieldWidget | null {
  const field = map.fields[name];
  if (!field?.widgets?.length) return null;
  const same = field.widgets.filter((w) => w.samePage !== false);
  const list = same.length ? same : field.widgets;
  return list[Math.min(index, list.length - 1)] ?? null;
}

/** White-out a mapped widget so printed template ink doesn't show through. */
function coverWidget(ctx: Ctx, name: string, index = 0) {
  const r = widgetRect(ctx.map, name, index);
  if (!r) return;
  ctx.page.drawRectangle({
    x: r.x,
    y: r.y,
    width: r.w,
    height: r.h,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

const HOUSE_WEEK_FIELDS = (n: number) =>
  [
    `Wkl${n}`,
    `Wk2${n}`,
    `Wk3${n}`,
    `Wk4${n}`,
    `WkS${n}`,
    `Wk6${n}`,
    `Wk7${n}`,
    `WkS${n}_2`,
  ] as const;

/** Stamp one house into template row slot 1–8 (age, placed, weeks, temp, total). */
function stampServiceReportHouseRow(ctx: Ctx, house: ServiceHouseRow, slot: number) {
  const n = slot;
  setText(ctx, `Age${n}`, house.age, 7);
  setText(ctx, `No Placed${n}`, house.placed, 7);
  const weekNames = HOUSE_WEEK_FIELDS(n);
  house.weeks.forEach((wk, wi) => setText(ctx, weekNames[wi]!, wk, 6));
  setText(ctx, `Current Temp${n}`, house.currentTemp, 7);
  setText(ctx, `Mortality To Date${n}`, house.mortalityToDate, 7);
}

/**
 * Continuation pages reuse the template with houses 1–8 printed.
 * Cover the # cell and write the real house number (9–16, …).
 */
function stampContinuationHouseNumber(ctx: Ctx, houseNumber: number, slot: number) {
  const ageR = widgetRect(ctx.map, `Age${slot}`);
  if (!ageR) return;
  const houseLeft = 12;
  const houseWidth = Math.max(18, ageR.x - houseLeft - 0.75);
  ctx.page.drawRectangle({
    x: houseLeft,
    y: ageR.y - 3,
    width: houseWidth,
    height: ageR.h + 6,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
  const label = String(houseNumber);
  const size = label.length > 1 ? 7.5 : 8;
  ctx.page.drawText(label, {
    x: houseLeft + (label.length > 1 ? 3 : 5),
    y: ageR.y + Math.max(0.5, (ageR.h - size) * 0.35),
    size,
    font: ctx.font,
    color: rgb(0, 0, 0),
  });
}

function setText(
  ctx: Ctx,
  name: string,
  value: string,
  fontSize = 8,
  opts?: StampOpts,
) {
  const v = String(value ?? "").trim();
  if (!v) return;
  const r = widgetRect(ctx.map, name, opts?.widgetIndex ?? 0);
  if (!r) return;
  if (opts?.coverPrinted === "field") {
    ctx.page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
  }
  const size = Math.min(fontSize, Math.max(5, r.h * 0.82));
  const xPad = opts?.xPad ?? 1.5;
  const yNudge = opts?.yNudge ?? 0;
  ctx.page.drawText(v, {
    x: r.x + xPad,
    y: r.y + Math.max(0.5, (r.h - size) * 0.35) + yNudge,
    size,
    font: ctx.font,
    color: rgb(0, 0, 0),
    maxWidth: Math.max(4, r.w - xPad - 2),
  });
}

/** Stamp on/off into the two halves of a printed "n / n" box. Do not draw a slash. */
function stampMinVentSides(
  ctx: Ctx,
  name: string,
  on: string,
  off: string,
  fontSize = 7,
  opts?: { yNudge?: number },
) {
  const left = String(on ?? "").trim();
  const right = String(off ?? "").trim();
  if (!left && !right) return;
  const r = widgetRect(ctx.map, name);
  if (!r) return;
  const size = Math.min(fontSize, Math.max(5, r.h * 0.82));
  const y = r.y + Math.max(0.5, (r.h - size) * 0.35) + (opts?.yNudge ?? 0);
  const { left: leftBox, right: rightBox } = minVentSideBoxes(r);
  if (left) {
    const tw = ctx.font.widthOfTextAtSize(left, size);
    ctx.page.drawText(left, {
      x: minVentCenteredX(leftBox, tw),
      y,
      size,
      font: ctx.font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(4, leftBox.w),
    });
  }
  if (right) {
    const tw = ctx.font.widthOfTextAtSize(right, size);
    ctx.page.drawText(right, {
      x: minVentCenteredX(rightBox, tw),
      y,
      size,
      font: ctx.font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(4, rightBox.w),
    });
  }
}

const BACKUP_SETTING_FIELDS = ["Text94", "Text95", "Text96", "Text97", "Text98"] as const;

/** Center Heat/Cool/Stage values on one baseline inside the printed boxes. */
function stampBackupSettings(ctx: Ctx, values: string[]) {
  const size = 8;
  const rects = BACKUP_SETTING_FIELDS.map((name) => widgetRect(ctx.map, name));
  const present = rects.filter((r): r is FieldWidget => r != null);
  if (!present.length) return;
  const midY = present.reduce((sum, r) => sum + r.y + r.h / 2, 0) / present.length;
  const y = midY - size * 0.45;
  values.forEach((value, i) => {
    const v = String(value ?? "").trim();
    const r = rects[i];
    if (!v || !r) return;
    const tw = ctx.font.widthOfTextAtSize(v, size);
    ctx.page.drawText(v, {
      x: r.x + Math.max(1, (r.w - tw) / 2),
      y,
      size,
      font: ctx.font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(4, r.w - 2),
    });
  });
}

function markCheck(ctx: Ctx, name: string, on: boolean, widgetIndex = 0) {
  if (!on) return;
  const r = widgetRect(ctx.map, name, widgetIndex);
  if (!r) return;
  const size = Math.min(Math.max(r.h * 0.9, 8), 11);
  ctx.page.drawText("X", {
    x: r.x + r.w / 2 - size * 0.35,
    y: r.y + r.h / 2 - size * 0.35,
    size,
    font: ctx.font,
    color: rgb(0, 0, 0),
  });
}

function markYesNo(
  ctx: Ctx,
  yesName: string,
  noName: string,
  value: YesNo,
  yesWidget = 0,
  noWidget = 0,
) {
  markCheck(ctx, yesName, value === "yes", yesWidget);
  markCheck(ctx, noName, value === "no", noWidget);
}

function takeCommentLine(
  words: string[],
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): { line: string; rest: string[] } {
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const word = words[i]!;
    const next = cur ? `${cur} ${word}` : word;
    if (cur && font.widthOfTextAtSize(next, fontSize) > maxWidth) break;
    cur = next;
  }
  return { line: cur, rest: words.slice(i) };
}

function fillCommentLines(ctx: Ctx, names: string[], text: string) {
  const fontSize = 8;
  let words = String(text ?? "")
    .split(/\s+/)
    .filter(Boolean);
  for (const name of names) {
    if (words.length === 0) break;
    const r = widgetRect(ctx.map, name, 0);
    const maxWidth = r ? Math.max(40, r.w * 0.92) : ctx.page.getWidth() * 0.9;
    const { line, rest } = takeCommentLine(words, ctx.font, fontSize, maxWidth);
    if (!line) {
      setText(ctx, name, words[0]!, fontSize);
      words = words.slice(1);
      continue;
    }
    setText(ctx, name, line, fontSize);
    words = rest;
  }
}

async function loadTemplate(moduleRef: number) {
  const asset = Asset.fromModule(moduleRef);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("Could not load PDF template");

  // expo-file-system read/write is native-only. Web must fetch the asset.
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    if (!res.ok) throw new Error("Could not load PDF template");
    return PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
  }

  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return PDFDocument.load(raw);
}

function buildServiceReportFields(
  ctx: Ctx,
  data: ServiceReportForm,
  housesSlice: ServiceReportForm["houses"],
) {
  setText(ctx, "Farm Name", data.farmName, 10);
  setText(ctx, "Date", formatServiceShortDate(data.date) || data.date, 10);
  setText(ctx, "Farm", data.farmNumber ?? "", 9, { yNudge: 2.5 });
  setText(ctx, "Flock", data.flockNumber ?? "", 9, { yNudge: 2.5 });

  for (let i = 0; i < 8; i++) {
    const h = housesSlice[i];
    if (!h) continue;
    stampServiceReportHouseRow(ctx, h, i + 1);
  }

  markYesNo(ctx, "Check Box5", "Check Box8", data.feederHeightOk);
  markYesNo(ctx, "Check Box6", "Check Box2", data.feedingEquipmentOk);
  markYesNo(ctx, "Check Box7", "Check Box3", data.feedAvailabilityOk);

  markYesNo(ctx, "Check Box13", "Check Box15", data.lightIntensityOk);
  markYesNo(ctx, "Check Box14", "Check Box16", data.lightsOperationalOk);
  setText(ctx, "Text44", data.lightsOnAt, 8);
  setText(ctx, "Text45", data.lightsOffAt, 8);

  markYesNo(ctx, "Check Box9", "Check Box10", data.tempTargetsOk);
  setText(ctx, "Text48", data.actualTempTarget, 8);
  setText(ctx, "Text47", data.recommendedTempTarget, 8);
  markYesNo(ctx, "Check Box11", "Check Box12", data.ammoniaOk);
  setText(ctx, " Humidity", data.humidityPct ? `${data.humidityPct}%` : "", 8);

  markCheck(ctx, "Check Box17", data.ventModes.includes("min"));
  markCheck(ctx, "Check Box18", data.ventModes.includes("power"));
  markCheck(ctx, "Check Box19", data.ventModes.includes("tunnel"));
  setText(ctx, "Tunnel Fans", data.tunnelFanCount, 8);

  markCheck(ctx, "Check Box20", data.ventDoorTypes.includes("ceiling"));
  markCheck(ctx, "Check Box21", data.ventDoorTypes.includes("sidewall"));
  setText(ctx, "Text49", data.staticPressure, 8);
  setText(ctx, "Text50", data.ventOpeningInches, 8);
  setText(ctx, "CFM Ft2 Min Vent", data.cfmPerFt2MinVent, 8);
  setText(ctx, "Text51", data.fansSizeAndCount, 8);

  // Do not white-out trailing cells — that wipe spilled past the field and
  // covered printed form lines to the right of Actual / Recommended.
  setText(
    ctx,
    "Text53",
    formatMinVentPair(data.minVentActualOn, data.minVentActualOff),
    6,
  );
  setText(
    ctx,
    "Text52",
    formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff),
    6,
  );
  setText(ctx, "300Max CFM Ft2 Power", data.maxCfm, 8);
  setText(ctx, "Degrees I", data.coolCellOffTemp, 8);
  setText(ctx, "Text54", data.coolCellOnTemp, 8);
  setText(
    ctx,
    "Text55",
    data.coolCellTimerOn || data.coolCellTimerOff
      ? `${data.coolCellTimerOn}/${data.coolCellTimerOff}`
      : "",
    8,
  );

  markYesNo(ctx, "Check Box22", "Check Box25", data.waterLinesOk);
  markYesNo(ctx, "Check Box23", "Check Box29", data.sightTubesOk);
  markYesNo(ctx, "Check Box24", "Check Box28", data.waterAdditive);
  setText(ctx, "PSI before", data.psiBefore, 8);
  setText(ctx, "PSI after", data.psiAfter, 8);
  setText(ctx, "Text56", data.ph, 8);

  markYesNo(ctx, "Check Box30", "Check Box32", data.partitionedOk);
  markYesNo(ctx, "Check Box31", "Check Box33", data.comfortableSpreadOk);

  markYesNo(ctx, "Check Box38", "Check Box41", data.premiseCleanOk);
  markYesNo(ctx, "Check Box39", "Check Box42", data.rodenticideOk);
  markYesNo(ctx, "Check Box40", "Check Box43", data.footBathsOk);

  markYesNo(ctx, "Check Box34", "Check Box36", data.generatorAutoOk);
  markYesNo(ctx, "Check Box35", "Check Box37", data.dialerOnOk);
  setText(ctx, "Text57", data.alarmHi, 8);
  setText(ctx, "Text58", data.alarmLow, 8);
  setText(ctx, "Text59", data.backupHeat, 8);
  setText(ctx, "Text60", data.backupCool, 8);
  setText(ctx, "Text61", data.backupStage1, 8);
  setText(ctx, "Text62", data.backupStage2, 8);
  setText(ctx, "Text63", data.backupStage3, 8);

  fillCommentLines(
    ctx,
    [
      "COMMENTS 1",
      "COMMENTS 2",
      "COMMENTS 3",
      "Comments 4",
      "Comments 5",
      "Comments 6",
      "Comments 7",
      "Comments 8",
      "Comments 9",
    ],
    data.comments,
  );
  setText(ctx, "Text64", data.serviceTech, 10);
}

function buildPlacementFields(ctx: Ctx, data: PlacementForm) {
  setText(ctx, "Farm Name_2", data.farmName, 9);
  setText(ctx, "Text65", data.farmNumber, 9, { yNudge: 2.5 });
  setText(ctx, "Text66", data.flockNumber, 9, { yNudge: 2.5 });
  setText(ctx, "Text67", formatServiceShortDate(data.date) || data.date, 9);

  markYesNo(ctx, "Check Box113", "Check Box116", data.supplementalLidsOk);
  markYesNo(ctx, "Check Box114", "Check Box117", data.feederPaperOk);
  markYesNo(ctx, "Check Box115", "Check Box118", data.feedTrayRibsOk, 0, 0);
  markYesNo(ctx, "Check Box123", "Check Box124", data.turboFeedersFullOk);

  markCheck(ctx, "Check Box118", data.bulbsReplacedOk === "yes", 1);
  markCheck(ctx, "Check Box121", data.bulbsReplacedOk === "no", 0);
  markYesNo(ctx, "Check Box119", "Check Box122", data.lightsFullIntensityOk);
  markCheck(ctx, "Check Box120", data.callPanLightsOk === "yes", 0);
  markCheck(ctx, "Check Box118", data.callPanLightsOk === "no", 2);
  markYesNo(ctx, "Check Box125", "Check Box126", data.broodLightsOnOk);

  markYesNo(ctx, "Check Box131", "Check Box134", data.tempDay1Ok);
  markYesNo(ctx, "Check Box132", "Check Box135", data.litterAmendmentOk);
  markCheck(ctx, "Check Box130", data.litterAmendmentType === "PLT");
  markCheck(ctx, "Check Box129", data.litterAmendmentType === "Pure7");
  markYesNo(ctx, "Check Box133", "Check Box136", data.heatersOk);
  markYesNo(ctx, "Check Box127", "Check Box128", data.sensorsBirdLevelOk);

  markCheck(ctx, "Check Box137", data.ventDoorTypes.includes("ceiling"));
  markCheck(ctx, "Check Box138", data.ventDoorTypes.includes("sidewall"));
  setText(ctx, "Text68", data.staticPressure, 7);
  setText(ctx, "Text69", data.ventOpeningInches, 7);
  setText(ctx, "Text70", data.cfmPerFt2MinVent, 7);
  setText(ctx, "Text89", data.fansSizeAndCount, 7);
  stampMinVentSides(ctx, "Text71", data.minVentActualOn, data.minVentActualOff);
  // Recommended widget is taller/lower than the printed box — lift to match actual.
  stampMinVentSides(ctx, "Text88", data.minVentRecommendedOn, data.minVentRecommendedOff, 7, {
    yNudge: 3,
  });

  const sorted = [...data.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const litterFields = [
    "Text72",
    "Text73",
    "Text74",
    "Text75",
    "Text76",
    "Text77",
    "Text78",
    "Text79",
  ];
  const ammoniaFields = [
    "Text80",
    "Text81",
    "Text82",
    "Text83",
    "Text84",
    "Text85",
    "Text86",
    "Text87",
  ];
  litterFields.forEach((name, i) =>
    setText(ctx, name, sorted[i]?.litterTemp ?? "", 7),
  );
  ammoniaFields.forEach((name, i) =>
    setText(ctx, name, sorted[i]?.ammoniaPpm ?? "", 7),
  );

  markYesNo(ctx, "Check Box139", "Check Box142", data.sightTubesOk);
  markYesNo(ctx, "Check Box140", "Check Box143", data.proxyTestOk);
  markYesNo(ctx, "Check Box141", "Check Box144", data.waterAdditive);
  setText(ctx, "Text90", data.psiBefore, 8);
  setText(ctx, "Text91", data.psiAfter, 8);
  setText(ctx, "Text92", data.waterColumnInches, 8);
  setText(ctx, "Text93", data.ph, 8);

  markYesNo(ctx, "Check Box145", "Check Box146", data.partitionedOk);
  markYesNo(ctx, "Check Box147", "Check Box150", data.premiseCleanOk);
  markYesNo(ctx, "Check Box148", "Check Box151", data.rodenticideOk);
  markYesNo(ctx, "Check Box149", "Check Box152", data.footBathsOk);
  markYesNo(ctx, "Check Box153", "Check Box155", data.generatorAutoOk);
  markYesNo(ctx, "Check Box154", "Check Box156", data.dialerOnOk);

  setText(ctx, "HIController Temp Alarm Setting", data.alarmHi, 8);
  setText(ctx, "LOWController Temp Alarm Setting", data.alarmLow, 8);
  stampBackupSettings(ctx, [
    data.backupHeat,
    data.backupCool,
    data.backupStage1,
    data.backupStage2,
    data.backupStage3,
  ]);

  fillCommentLines(
    ctx,
    [
      "Comments first line",
      "Comments 1",
      "Comments 2",
      "Comments 3",
      "Comments 4",
      "Comments 5",
      "Comments 6",
      "Comments 7",
      "Comments 8",
      "Comments 9",
    ],
    data.comments,
  );
  setText(ctx, "undefined", data.serviceTech, 10);
}

function buildPrebroodFields(ctx: Ctx, data: PrebroodForm) {
  setText(ctx, "Farm Name_3", data.farmName, 9);
  setText(ctx, "Text100", data.farmNumber, 9, { yNudge: 2.5 });
  setText(ctx, "Text99", data.flockNumber, 9, { yNudge: 2.5 });
  setText(ctx, "Text101", formatServiceShortDate(data.date) || data.date, 9);

  markCheck(ctx, "Check Box157", data.windowHours === "48");
  markCheck(ctx, "Check Box158", data.windowHours === "72");

  markYesNo(ctx, "Check Box159", "Check Box162", data.feedDeliveredOk);
  markYesNo(ctx, "Check Box160", "Check Box163", data.feedPaperDeliveredOk);
  markYesNo(ctx, "Check Box161", "Check Box164", data.supplementalLidsDeliveredOk);

  markYesNo(ctx, "Check Box165", "Check Box167", data.bulbsReplacedOk);
  markYesNo(ctx, "Check Box166", "Check Box168", data.lightingProgramOk);

  markYesNo(ctx, "Check Box169", "Check Box175", data.moistureChartOk);
  markYesNo(ctx, "Check Box170", "Check Box176", data.litterAmendmentOk);
  markCheck(ctx, "Check Box208", data.litterAmendmentType === "PLT");
  markCheck(ctx, "Check Box209", data.litterAmendmentType === "Pure7");
  markYesNo(ctx, "Check Box171", "Check Box177", data.minVentOnOk);
  markYesNo(ctx, "Check Box172", "Check Box178", data.fansCleanOk);
  markYesNo(ctx, "Check Box173", "Check Box179", data.tempDay1Ok);
  markYesNo(ctx, "Check Box174", "Check Box180", data.cakeOutOk);
  markYesNo(ctx, "Check Box210", "Check Box211", data.cleanOutPadTreatOk);
  markYesNo(ctx, "Check Box181", "Check Box183", data.litterDepthOk);
  markYesNo(ctx, "Check Box182", "Check Box184", data.heatersOk);

  const sorted = [...data.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const ammoniaFields = [
    "Text102",
    "Text103",
    "Text104",
    "Text105",
    "Text106",
    "Text107",
    "Text108",
    "Text109",
  ];
  ammoniaFields.forEach((name, i) =>
    setText(ctx, name, sorted[i]?.ammoniaPpm ?? "", 7),
  );

  markYesNo(ctx, "Check Box185", "Check Box192", data.sightTubesOk);
  markYesNo(ctx, "Check Box186", "Check Box193", data.waterLinesSanitizedOk);

  markYesNo(ctx, "Check Box187", "Check Box190", data.premiseCleanOk);
  markYesNo(ctx, "Check Box189", "Check Box191", data.insecticideOk);
  markCheck(ctx, "Check Box194", data.insecticideType === "CV");
  markCheck(ctx, "Check Box195", data.insecticideType === "RVO");

  markYesNo(ctx, "Check Box196", "Check Box202", data.blockHeaterOk);
  markYesNo(ctx, "Check Box197", "Check Box203", data.batteryMaintainerOk);
  markYesNo(ctx, "Check Box198", "Check Box204", data.generatorTestOk);
  markYesNo(ctx, "Check Box199", "Check Box205", data.dialerTestOk);
  markYesNo(ctx, "Check Box200", "Check Box206", data.generatorServicedOk);
  setText(
    ctx,
    "Text110",
    data.generatorServicedOk === "yes"
      ? formatServiceShortDate(data.generatorServiceDate)
      : "",
    8,
    { xPad: 12 },
  );

  fillCommentLines(
    ctx,
    [
      "Comments first line",
      "Comments 1_2",
      "Comments 2_2",
      "Comments 3_2",
      "Comments 4_2",
      "Comments 5_2",
      "Comments 6_2",
      "Comments 7_2",
      "Comments 8_2",
      "comments 9",
      "comments 10",
      "comments 11",
      "comments 12",
      "comments 13",
    ],
    data.comments,
  );
  setText(ctx, "Text111", data.serviceTech, 10);
}

export type BuiltServicePdf = {
  uri: string;
  bytes: Uint8Array;
  filename: string;
};

export async function buildServiceFormPdf(form: AnyServiceForm): Promise<BuiltServicePdf> {
  if (form.kind === "service_report") return buildServiceReportPdf(form);
  if (form.kind === "placement") return buildPlacementPdf(form);
  return buildPrebroodPdf(form);
}

async function buildServiceReportPdf(form: ServiceReportForm) {
  const template = require("../../../assets/service-forms/service-report.pdf");
  const map = require("../../../assets/service-forms/service-report-fields.json") as FieldMap;
  const houses = [...form.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const pages: (typeof houses)[] = [];
  for (let i = 0; i < Math.max(houses.length, 1); i += 8) {
    pages.push(houses.slice(i, i + 8));
  }

  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ctx: Ctx = { page: doc.getPages()[0]!, font, map };
  buildServiceReportFields(ctx, form, pages[0] ?? []);

  for (let p = 1; p < pages.length; p++) {
    const templateDoc = await loadTemplate(template);
    const [blank] = await doc.copyPages(templateDoc, [0]);
    doc.addPage(blank);
    const page = doc.getPages()[doc.getPageCount() - 1]!;
    const slice = pages[p]!;
    const extraCtx: Ctx = { page, font, map };

    // Header so the continuation page is identifiable.
    setText(extraCtx, "Farm Name", form.farmName, 10);
    setText(extraCtx, "Date", formatServiceShortDate(form.date) || form.date, 10);
    setText(extraCtx, "Farm", form.farmNumber ?? "", 9);
    setText(extraCtx, "Flock", form.flockNumber ?? "", 9);

    for (let i = 0; i < 8; i++) {
      const h = slice[i];
      if (!h) continue;
      const slot = i + 1;
      stampContinuationHouseNumber(extraCtx, h.houseNumber, slot);
      // Clear age / placed cells before fill (template may have guides).
      coverWidget(extraCtx, `Age${slot}`);
      coverWidget(extraCtx, `No Placed${slot}`);
      for (const weekName of HOUSE_WEEK_FIELDS(slot)) {
        coverWidget(extraCtx, weekName);
      }
      coverWidget(extraCtx, `Current Temp${slot}`);
      coverWidget(extraCtx, `Mortality To Date${slot}`);
      stampServiceReportHouseRow(extraCtx, h, slot);
    }
  }

  return writePdfToCache(doc, pdfFileName("Service-Report", form.farmName, form.date));
}

async function buildPlacementPdf(form: PlacementForm) {
  const template = require("../../../assets/service-forms/placement.pdf");
  const map = require("../../../assets/service-forms/placement-fields.json") as FieldMap;
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  buildPlacementFields({ page: doc.getPages()[0]!, font, map }, form);
  return writePdfToCache(doc, pdfFileName("Placement", form.farmName, form.date));
}

async function buildPrebroodPdf(form: PrebroodForm) {
  const template = require("../../../assets/service-forms/prebrood.pdf");
  const map = require("../../../assets/service-forms/prebrood-fields.json") as FieldMap;
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  buildPrebroodFields({ page: doc.getPages()[0]!, font, map }, form);
  return writePdfToCache(doc, pdfFileName("Prebrood", form.farmName, form.date));
}

/** Friendly name for Save to Files / AirDrop (e.g. Service-Report-NORTH-RIDGE-2026-07-29.pdf). */
function pdfFileName(kind: string, farmName: string, date: string) {
  const farm = String(farmName || "Farm")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "Farm";
  const day = String(date || "").trim() || "date";
  return `${kind}-${farm}-${day}.pdf`;
}

async function writePdfToCache(doc: PDFDocument, filename: string): Promise<BuiltServicePdf> {
  const bytes = await doc.save({ updateFieldAppearances: false });
  if (Platform.OS === "web") {
    return { uri: "", bytes, filename };
  }
  const base64 =
    typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("base64") : uint8ToBase64(bytes);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri, bytes, filename };
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
