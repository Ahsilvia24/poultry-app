/**
 * Build Bachoco service PDFs from the fillable AcroForm templates.
 * Text values go into named fields; checkmarks are stamped as "X" at each
 * checkbox widget’s center. Checkbox (and text) widget borders/backgrounds
 * are hidden so only the printed form grid remains.
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  PDFDocument,
  PDFName,
  PDFNumber,
  StandardFonts,
  rgb,
  type PDFCheckBox,
  type PDFFont,
  type PDFForm,
  type PDFPage,
  type PDFTextField,
} from "pdf-lib";
import type {
  AnyServiceForm,
  PlacementForm,
  PrebroodForm,
  ServiceReportForm,
  YesNo,
} from "./types";
import { formatMinVentPair, formatServiceShortDate } from "./format";

/** Hide AcroForm widget chrome (border + fill) so the scan shows through. */
function stripWidgetChrome(field: { acroField: { getWidgets: () => Array<{
  setBorderWidth: (n: number) => void;
  dict: { lookup: (n: unknown) => unknown; set: (n: unknown, v: unknown) => void };
}> } }, opts?: { hide?: boolean }) {
  for (const widget of field.acroField.getWidgets()) {
    try {
      widget.setBorderWidth(0);
    } catch {
      /* ignore */
    }
    try {
      const mk = widget.dict.lookup(PDFName.of("MK")) as
        | { delete?: (n: unknown) => void }
        | undefined;
      mk?.delete?.(PDFName.of("BC"));
      mk?.delete?.(PDFName.of("BG"));
    } catch {
      /* ignore */
    }
    if (opts?.hide) {
      try {
        const cur = widget.dict.lookup(PDFName.of("F")) as
          | { asNumber?: () => number }
          | undefined;
        const flags = cur?.asNumber?.() ?? 0;
        // Bit 1 = Hidden — keeps overlay checkbox squares from printing.
        widget.dict.set(PDFName.of("F"), PDFNumber.of(flags | 2));
      } catch {
        /* ignore */
      }
    }
  }
}

/** Store value on the field (for data) and stamp visible text; hide widget chrome. */
function setText(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  name: string,
  value: string,
  fontSize = 8,
) {
  const v = String(value ?? "").trim();
  if (!v) return;
  try {
    const field = form.getTextField(name);
    try {
      field.setText(v);
    } catch {
      /* ignore */
    }
    stripWidgetChrome(field, { hide: true });
    const r = widgetRect(field);
    const size = Math.min(fontSize, Math.max(5, r.height * 0.82));
    page.drawText(v, {
      x: r.x + 1.5,
      y: r.y + Math.max(0.5, (r.height - size) * 0.35),
      size,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(4, r.width - 3),
    });
  } catch {
    /* field missing on this template */
  }
}

function widgetRect(field: PDFCheckBox | PDFTextField, index = 0) {
  const widgets = field.acroField.getWidgets();
  const w = widgets[Math.min(index, widgets.length - 1)]!;
  return w.getRectangle();
}

/** Stamp an X at a checkbox widget; hide the widget border. */
function markCheck(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  name: string,
  on: boolean,
  widgetIndex = 0,
) {
  if (!on) {
    try {
      stripWidgetChrome(form.getCheckBox(name), { hide: true });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const field = form.getCheckBox(name);
    stripWidgetChrome(field, { hide: true });
    const r = widgetRect(field, widgetIndex);
    const size = Math.min(Math.max(r.height * 0.9, 8), 11);
    page.drawText("X", {
      x: r.x + r.width / 2 - size * 0.35,
      y: r.y + r.height / 2 - size * 0.35,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  } catch {
    /* ignore */
  }
}

function markYesNo(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  yesName: string,
  noName: string,
  value: YesNo,
  yesWidget = 0,
  noWidget = 0,
) {
  markCheck(form, page, font, yesName, value === "yes", yesWidget);
  markCheck(form, page, font, noName, value === "no", noWidget);
}

/** Hide every checkbox widget on the form (printed squares stay). */
function hideAllCheckboxes(form: PDFForm) {
  for (const field of form.getFields()) {
    if (field.constructor.name.includes("Check")) {
      stripWidgetChrome(field as PDFCheckBox, { hide: true });
    } else {
      stripWidgetChrome(field as PDFTextField);
    }
  }
}

function fillCommentLines(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  names: string[],
  text: string,
) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const t = line.trim();
      if (!t) return [];
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
  names.forEach((name, i) => setText(form, page, font, name, lines[i] ?? "", 8));
}

/** Drop AcroForm widgets so shared PDFs show stamped values without field borders. */
function stripFormAnnotations(doc: PDFDocument) {
  for (const page of doc.getPages()) {
    try {
      page.node.delete(PDFName.of("Annots"));
    } catch {
      /* ignore */
    }
  }
  try {
    doc.catalog.delete(PDFName.of("AcroForm"));
  } catch {
    /* ignore */
  }
}

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
) {
  hideAllCheckboxes(form);

  setText(form, page, font, "Farm Name", data.farmName, 10);
  setText(form, page, font, "Date", formatServiceShortDate(data.date) || data.date, 10);
  setText(form, page, font, "Farm", data.farmNumber ?? "", 9);
  setText(form, page, font, "Flock", data.flockNumber ?? "", 9);

  for (let i = 0; i < 8; i++) {
    const h = housesSlice[i];
    if (!h) continue;
    const n = i + 1;
    setText(form, page, font, `Age${n}`, h.age, 7);
    setText(form, page, font, `No Placed${n}`, h.placed, 7);
    const weekNames = [
      `Wkl${n}`,
      `Wk2${n}`,
      `Wk3${n}`,
      `Wk4${n}`,
      `WkS${n}`,
      `Wk6${n}`,
      `Wk7${n}`,
      `WkS${n}_2`,
    ];
    h.weeks.forEach((wk, wi) => setText(form, page, font, weekNames[wi]!, wk, 6));
    setText(form, page, font, `Current Temp${n}`, h.currentTemp, 7);
    setText(form, page, font, `Mortality To Date${n}`, h.mortalityToDate, 7);
    // Bins intentionally blank per product rules.
  }

  // Feed
  markYesNo(form, page, font, "Check Box5", "Check Box8", data.feederHeightOk);
  markYesNo(form, page, font, "Check Box6", "Check Box2", data.feedingEquipmentOk);
  markYesNo(form, page, font, "Check Box7", "Check Box3", data.feedAvailabilityOk);

  // Light
  markYesNo(form, page, font, "Check Box13", "Check Box15", data.lightIntensityOk);
  markYesNo(form, page, font, "Check Box14", "Check Box16", data.lightsOperationalOk);
  setText(form, page, font, "Text44", data.lightsOnAt, 8);
  setText(form, page, font, "Text45", data.lightsOffAt, 8);

  // Air
  markYesNo(form, page, font, "Check Box9", "Check Box10", data.tempTargetsOk);
  if (data.tempTargetsOk === "no") {
    setText(form, page, font, "Text48", data.actualTempTarget, 8);
    setText(form, page, font, "Text47", data.recommendedTempTarget, 8);
  }
  markYesNo(form, page, font, "Check Box11", "Check Box12", data.ammoniaOk);
  setText(form, page, font, " Humidity", data.humidityPct ? `${data.humidityPct}%` : "", 8);

  markCheck(form, page, font, "Check Box17", data.ventModes.includes("min"));
  markCheck(form, page, font, "Check Box18", data.ventModes.includes("power"));
  markCheck(form, page, font, "Check Box19", data.ventModes.includes("tunnel"));
  setText(form, page, font, "Tunnel Fans", data.tunnelFanCount, 8);

  markCheck(form, page, font, "Check Box20", data.ventDoorType === "ceiling");
  markCheck(form, page, font, "Check Box21", data.ventDoorType === "sidewall");
  setText(form, page, font, "Text49", data.staticPressure, 8);
  setText(form, page, font, "Text50", data.ventOpeningInches, 8);
  setText(form, page, font, "CFM Ft2 Min Vent", data.cfmPerFt2MinVent, 8);
  setText(form, page, font, "Text51", data.fansSizeAndCount, 8);

  setText(
    form,
    page,
    font,
    "Text53",
    formatMinVentPair(data.minVentActualOn, data.minVentActualOff),
    6,
  );
  setText(
    form,
    page,
    font,
    "Text52",
    formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff),
    6,
  );
  setText(form, page, font, "300Max CFM Ft2 Power", data.maxCfm, 8);
  setText(form, page, font, "Degrees I", data.coolCellOffTemp, 8);
  setText(form, page, font, "Text54", data.coolCellOnTemp, 8);
  setText(
    form,
    page,
    font,
    "Text55",
    data.coolCellTimerOn || data.coolCellTimerOff
      ? `${data.coolCellTimerOn}/${data.coolCellTimerOff}`
      : "",
    8,
  );

  // Water
  markYesNo(form, page, font, "Check Box22", "Check Box25", data.waterLinesOk);
  markYesNo(form, page, font, "Check Box23", "Check Box29", data.sightTubesOk);
  markYesNo(form, page, font, "Check Box24", "Check Box28", data.waterAdditive);
  setText(form, page, font, "PSI before", data.psiBefore, 8);
  setText(form, page, font, "PSI after", data.psiAfter, 8);
  setText(form, page, font, "Text56", data.ph, 8);
  // Water column — no dedicated named field on template; leave blank if absent.

  // Space
  markYesNo(form, page, font, "Check Box30", "Check Box32", data.partitionedOk);
  markYesNo(form, page, font, "Check Box31", "Check Box33", data.comfortableSpreadOk);

  // Sanitation (right column)
  markYesNo(form, page, font, "Check Box38", "Check Box41", data.premiseCleanOk);
  markYesNo(form, page, font, "Check Box39", "Check Box42", data.rodenticideOk);
  markYesNo(form, page, font, "Check Box40", "Check Box43", data.footBathsOk);

  // Emergency
  markYesNo(form, page, font, "Check Box34", "Check Box36", data.generatorAutoOk);
  markYesNo(form, page, font, "Check Box35", "Check Box37", data.dialerOnOk);
  setText(form, page, font, "Text57", data.alarmHi, 8);
  setText(form, page, font, "Text58", data.alarmLow, 8);
  setText(form, page, font, "Text59", data.backupHeat, 8);
  setText(form, page, font, "Text60", data.backupCool, 8);
  setText(form, page, font, "Text61", data.backupStage1, 8);
  setText(form, page, font, "Text62", data.backupStage2, 8);
  setText(form, page, font, "Text63", data.backupStage3, 8);

  fillCommentLines(
    form,
    page,
    font,
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
  setText(form, page, font, "Text64", data.serviceTech, 10);
}

function buildPlacementFields(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  data: PlacementForm,
) {
  hideAllCheckboxes(form);

  setText(form, page, font, "Farm Name_2", data.farmName, 9);
  setText(form, page, font, "Text65", data.farmNumber, 9);
  setText(form, page, font, "Text66", data.flockNumber, 9);
  setText(form, page, font, "Text67", formatServiceShortDate(data.date) || data.date, 9);

  // Feed
  markYesNo(form, page, font, "Check Box113", "Check Box116", data.supplementalLidsOk);
  markYesNo(form, page, font, "Check Box114", "Check Box117", data.feederPaperOk);
  // Check Box118 has 3 widgets: [0]=feed-tray NO, [1]=bulbs YES, [2]=call-pan NO
  markYesNo(form, page, font, "Check Box115", "Check Box118", data.feedTrayRibsOk, 0, 0);
  markYesNo(form, page, font, "Check Box123", "Check Box124", data.turboFeedersFullOk);

  // Light — Box118 widget 1 is bulbs YES
  markCheck(form, page, font, "Check Box118", data.bulbsReplacedOk === "yes", 1);
  markCheck(form, page, font, "Check Box121", data.bulbsReplacedOk === "no", 0);
  markYesNo(form, page, font, "Check Box119", "Check Box122", data.lightsFullIntensityOk);
  markCheck(form, page, font, "Check Box120", data.callPanLightsOk === "yes", 0);
  markCheck(form, page, font, "Check Box118", data.callPanLightsOk === "no", 2);
  markYesNo(form, page, font, "Check Box125", "Check Box126", data.broodLightsOnOk);

  // Air
  markYesNo(form, page, font, "Check Box131", "Check Box134", data.tempDay1Ok);
  markYesNo(form, page, font, "Check Box132", "Check Box135", data.litterAmendmentOk);
  markCheck(form, page, font, "Check Box130", data.litterAmendmentType === "PLT");
  markCheck(form, page, font, "Check Box129", data.litterAmendmentType === "Pure7");
  markYesNo(form, page, font, "Check Box133", "Check Box136", data.heatersOk);
  markYesNo(form, page, font, "Check Box127", "Check Box128", data.sensorsBirdLevelOk);

  markCheck(form, page, font, "Check Box137", data.ventDoorType === "ceiling");
  markCheck(form, page, font, "Check Box138", data.ventDoorType === "sidewall");
  setText(form, page, font, "Text68", data.staticPressure, 7);
  setText(form, page, font, "Text69", data.ventOpeningInches, 7);
  setText(form, page, font, "Text70", data.cfmPerFt2MinVent, 7);
  setText(form, page, font, "Text89", data.fansSizeAndCount, 7);
  setText(
    form,
    page,
    font,
    "Text71",
    formatMinVentPair(data.minVentActualOn, data.minVentActualOff),
    6,
  );
  setText(
    form,
    page,
    font,
    "Text88",
    formatMinVentPair(data.minVentRecommendedOn, data.minVentRecommendedOff),
    6,
  );

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
    setText(form, page, font, name, sorted[i]?.litterTemp ?? "", 7),
  );
  ammoniaFields.forEach((name, i) =>
    setText(form, page, font, name, sorted[i]?.ammoniaPpm ?? "", 7),
  );

  // Water
  markYesNo(form, page, font, "Check Box139", "Check Box142", data.sightTubesOk);
  markYesNo(form, page, font, "Check Box140", "Check Box143", data.proxyTestOk);
  markYesNo(form, page, font, "Check Box141", "Check Box144", data.waterAdditive);
  setText(form, page, font, "Text90", data.psiBefore, 8);
  setText(form, page, font, "Text91", data.psiAfter, 8);
  setText(form, page, font, "Text92", data.waterColumnInches, 8);
  setText(form, page, font, "Text93", data.ph, 8);

  // Space / Sanitation / Emergency
  markYesNo(form, page, font, "Check Box145", "Check Box146", data.partitionedOk);
  markYesNo(form, page, font, "Check Box147", "Check Box150", data.premiseCleanOk);
  markYesNo(form, page, font, "Check Box148", "Check Box151", data.rodenticideOk);
  markYesNo(form, page, font, "Check Box149", "Check Box152", data.footBathsOk);
  markYesNo(form, page, font, "Check Box153", "Check Box155", data.generatorAutoOk);
  markYesNo(form, page, font, "Check Box154", "Check Box156", data.dialerOnOk);

  setText(form, page, font, "HIController Temp Alarm Setting", data.alarmHi, 8);
  setText(form, page, font, "LOWController Temp Alarm Setting", data.alarmLow, 8);
  setText(form, page, font, "Text94", data.backupHeat, 8);
  setText(form, page, font, "Text95", data.backupCool, 8);
  setText(form, page, font, "Text96", data.backupStage1, 8);
  setText(form, page, font, "Text97", data.backupStage2, 8);
  setText(form, page, font, "Text98", data.backupStage3, 8);

  fillCommentLines(
    form,
    page,
    font,
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
  setText(form, page, font, "undefined", data.serviceTech, 10);
}

function buildPrebroodFields(
  form: PDFForm,
  page: PDFPage,
  font: PDFFont,
  data: PrebroodForm,
) {
  hideAllCheckboxes(form);

  setText(form, page, font, "Farm Name_3", data.farmName, 9);
  setText(form, page, font, "Text100", data.farmNumber, 9);
  setText(form, page, font, "Text99", data.flockNumber, 9);
  setText(form, page, font, "Text101", formatServiceShortDate(data.date) || data.date, 9);

  markCheck(form, page, font, "Check Box157", data.windowHours === "48");
  markCheck(form, page, font, "Check Box158", data.windowHours === "72");

  // Feed
  markYesNo(form, page, font, "Check Box159", "Check Box162", data.feedDeliveredOk);
  markYesNo(form, page, font, "Check Box160", "Check Box163", data.feedPaperDeliveredOk);
  markYesNo(
    form,
    page,
    font,
    "Check Box161",
    "Check Box164",
    data.supplementalLidsDeliveredOk,
  );

  // Light
  markYesNo(form, page, font, "Check Box165", "Check Box167", data.bulbsReplacedOk);
  markYesNo(form, page, font, "Check Box166", "Check Box168", data.lightingProgramOk);

  // Air
  markYesNo(form, page, font, "Check Box169", "Check Box175", data.moistureChartOk);
  markYesNo(form, page, font, "Check Box170", "Check Box176", data.litterAmendmentOk);
  markCheck(form, page, font, "Check Box208", data.litterAmendmentType === "PLT");
  markCheck(form, page, font, "Check Box209", data.litterAmendmentType === "Pure7");
  markYesNo(form, page, font, "Check Box171", "Check Box177", data.minVentOnOk);
  markYesNo(form, page, font, "Check Box172", "Check Box178", data.fansCleanOk);
  markYesNo(form, page, font, "Check Box173", "Check Box179", data.tempDay1Ok);
  markYesNo(form, page, font, "Check Box174", "Check Box180", data.cakeOutOk);
  markYesNo(form, page, font, "Check Box210", "Check Box211", data.cleanOutPadTreatOk);
  markYesNo(form, page, font, "Check Box181", "Check Box183", data.litterDepthOk);
  markYesNo(form, page, font, "Check Box182", "Check Box184", data.heatersOk);

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
    setText(form, page, font, name, sorted[i]?.ammoniaPpm ?? "", 7),
  );

  // Water
  markYesNo(form, page, font, "Check Box185", "Check Box192", data.sightTubesOk);
  markYesNo(form, page, font, "Check Box186", "Check Box193", data.waterLinesSanitizedOk);

  // Sanitation
  markYesNo(form, page, font, "Check Box187", "Check Box190", data.premiseCleanOk);
  markYesNo(form, page, font, "Check Box189", "Check Box191", data.insecticideOk);
  markCheck(form, page, font, "Check Box194", data.insecticideType === "CV");
  markCheck(form, page, font, "Check Box195", data.insecticideType === "RVO");

  // Emergency
  markYesNo(form, page, font, "Check Box196", "Check Box202", data.blockHeaterOk);
  markYesNo(form, page, font, "Check Box197", "Check Box203", data.batteryMaintainerOk);
  markYesNo(form, page, font, "Check Box198", "Check Box204", data.generatorTestOk);
  markYesNo(form, page, font, "Check Box199", "Check Box205", data.dialerTestOk);
  markYesNo(form, page, font, "Check Box200", "Check Box206", data.generatorServicedOk);
  setText(
    form,
    page,
    font,
    "Text110",
    data.generatorServicedOk === "yes"
      ? formatServiceShortDate(data.generatorServiceDate)
      : "",
    8,
  );
  markYesNo(form, page, font, "Check Box201", "Check Box207", data.generatorHoursLoggedOk);
  // Hours value shares the service-date field area on some scans; put in comments if needed.

  fillCommentLines(
    form,
    page,
    font,
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
    [
      data.generatorHoursLoggedOk === "yes" && data.generatorHours
        ? `Generator hours: ${data.generatorHours}`
        : "",
      data.comments,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  setText(form, page, font, "Text111", data.serviceTech, 10);
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

  buildServiceReportFields(pdfForm, doc.getPages()[0]!, font, form, pages[0] ?? []);

  // Continuation pages (houses 9+) — copy blank template page and fill house grid only.
  for (let p = 1; p < pages.length; p++) {
    const templateDoc = await loadTemplate(template);
    const [blank] = await doc.copyPages(templateDoc, [0]);
    doc.addPage(blank);
    const page = doc.getPages()[doc.getPageCount() - 1]!;
    const slice = pages[p]!;
    for (let i = 0; i < 8; i++) {
      const h = slice[i];
      if (!h) continue;
      const yTops = [10.73, 12.79, 14.85, 16.88, 18.88, 20.91, 22.94, 24.91];
      const y = 792 - ((yTops[i]! + 1.2) / 100) * 792;
      page.drawRectangle({
        x: (3.2 / 100) * 612,
        y: y - 2,
        width: (2.2 / 100) * 612,
        height: 12,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });
      page.drawText(String(h.houseNumber), {
        x: (3.5 / 100) * 612,
        y,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(h.age, { x: (6.5 / 100) * 612, y, size: 7, font, color: rgb(0, 0, 0) });
      page.drawText(h.placed, {
        x: (12 / 100) * 612,
        y,
        size: 7,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  stripFormAnnotations(doc);
  return writePdfToCache(doc, `service-report-${Date.now()}.pdf`);
}

async function buildPlacementPdf(form: PlacementForm) {
  const template = require("../../../../assets/service-forms/placement.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfForm = doc.getForm();
  buildPlacementFields(pdfForm, doc.getPages()[0]!, font, form);
  stripFormAnnotations(doc);
  return writePdfToCache(doc, `placement-${Date.now()}.pdf`);
}

async function buildPrebroodPdf(form: PrebroodForm) {
  const template = require("../../../../assets/service-forms/prebrood.pdf");
  const doc = await loadTemplate(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfForm = doc.getForm();
  buildPrebroodFields(pdfForm, doc.getPages()[0]!, font, form);
  stripFormAnnotations(doc);
  return writePdfToCache(doc, `prebrood-${Date.now()}.pdf`);
}

async function writePdfToCache(doc: PDFDocument, filename: string) {
  const bytes = await doc.save({ updateFieldAppearances: false });
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
