import type { AnyServiceForm, ServiceHouseRow, YesNo } from "./types";
import {
  formatMinVentPair,
  formatServiceShortDate,
  resolveWaterColumnInches,
  yesNoLabel,
} from "./format";

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yn(v: YesNo) {
  return yesNoLabel(v);
}

function chunkHouses(houses: ServiceHouseRow[], size = 8) {
  const sorted = [...houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const pages: ServiceHouseRow[][] = [];
  for (let i = 0; i < sorted.length; i += size) {
    pages.push(sorted.slice(i, i + size));
  }
  if (pages.length === 0) pages.push([]);
  return pages;
}

function houseTableHtml(rows: ServiceHouseRow[], opts?: { litterAmmonia?: boolean }) {
  const pad = [...rows];
  while (pad.length < 8) {
    pad.push({
      houseNumber: 0,
      age: "",
      placed: "",
      weeks: ["", "", "", "", "", "", "", ""],
      currentTemp: "",
      mortalityToDate: "",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    });
  }
  const head = opts?.litterAmmonia
    ? `<tr>
        <th>#</th><th>Litter °</th><th>NH3</th>
      </tr>`
    : `<tr>
        <th>#</th><th>Age</th><th>Placed</th>
        <th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th>
        <th>Temp</th><th>Mort</th><th>Bin A</th><th>Bin B</th>
      </tr>`;
  const body = pad
    .map((h) => {
      const num = h.houseNumber > 0 ? String(h.houseNumber) : "";
      if (opts?.litterAmmonia) {
        return `<tr>
          <td>${esc(num)}</td>
          <td>${esc(h.litterTemp)}</td>
          <td>${esc(h.ammoniaPpm)}</td>
        </tr>`;
      }
      return `<tr>
        <td>${esc(num)}</td>
        <td>${esc(h.age)}</td>
        <td>${esc(h.placed)}</td>
        ${h.weeks.map((w) => `<td>${esc(w)}</td>`).join("")}
        <td>${esc(h.currentTemp)}</td>
        <td>${esc(h.mortalityToDate)}</td>
        <td>${esc(h.binA)}</td>
        <td>${esc(h.binB)}</td>
      </tr>`;
    })
    .join("");
  return `<table class="houses">${head}${body}</table>`;
}

function checkRow(label: string, v: YesNo) {
  return `<tr><td>${esc(label)}</td><td class="yn">${esc(yn(v))}</td></tr>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #111; margin: 16px; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 8px; }
  .meta { margin-bottom: 8px; }
  .meta div { margin: 2px 0; }
  h2 { font-size: 11px; margin: 10px 0 4px; border-bottom: 1px solid #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { border: 1px solid #444; padding: 2px 3px; vertical-align: top; }
  th { background: #f3f3f3; font-size: 9px; }
  .houses td, .houses th { text-align: center; font-size: 9px; }
  .yn { width: 48px; text-align: center; font-weight: 700; }
  .grid2 { display: flex; gap: 12px; }
  .grid2 > div { flex: 1; }
  .comments { min-height: 80px; border: 1px solid #444; padding: 6px; white-space: pre-wrap; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .muted { color: #666; font-size: 9px; }
`;

function wrap(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>${BASE_CSS}</style></head><body>
    <h1>${esc(title)}</h1>
    ${body}
    </body></html>`;
}

export function serviceReportPdfHtml(form: Extract<AnyServiceForm, { kind: "service_report" }>) {
  const pages = chunkHouses(form.houses, 8);
  const checklist = `
    <div class="grid2">
      <div>
        <h2>FEED</h2>
        <table>
          ${checkRow("Feeder Height Adjusted Properly For Birds", form.feederHeightOk)}
          ${checkRow("All Feeding Equipment Is Fully Operational", form.feedingEquipmentOk)}
          ${checkRow("Feed Availability Is Sufficient For Age Of Birds", form.feedAvailabilityOk)}
        </table>
        <h2>LIGHT</h2>
        <table>
          ${checkRow("Light Intensity Is Per Program For The Age Of Birds", form.lightIntensityOk)}
          ${checkRow("All Lights Are Operational", form.lightsOperationalOk)}
          <tr><td>Lights Are ON At</td><td>${esc(form.lightsOnAt)}</td></tr>
          <tr><td>Lights Are Off At</td><td>${esc(form.lightsOffAt)}</td></tr>
        </table>
        <h2>WATER</h2>
        <table>
          ${checkRow("Lines Are Adjusted Properly For Age Of Birds", form.waterLinesOk)}
          ${checkRow("Sight Tubes Are Clean", form.sightTubesOk)}
          ${checkRow("Anything Currently Added to Water", form.waterAdditive)}
          <tr><td>Inches of Water Column</td><td>${esc(resolveWaterColumnInches(form.waterColumnInches))}</td></tr>
          <tr><td>P.S.I Before / After</td><td>${esc(form.psiBefore)} / ${esc(form.psiAfter)}</td></tr>
          <tr><td>P.H.</td><td>${esc(form.ph)}</td></tr>
        </table>
      </div>
      <div>
        <h2>AIR AND LITTER</h2>
        <table>
          ${checkRow("Temp Targets Are Per Recommended Program", form.tempTargetsOk)}
          ${
            form.tempTargetsOk === "no"
              ? `<tr><td>Actual / Recommended Target</td><td>${esc(form.actualTempTarget)} / ${esc(form.recommendedTempTarget)}</td></tr>`
              : ""
          }
          ${checkRow("Ammonia Levels Are < 25 PPM In All Houses", form.ammoniaOk)}
          <tr><td>% Humidity</td><td>${esc(form.humidityPct ? `${form.humidityPct}%` : "")}</td></tr>
          <tr><td>Ventilation</td><td>${esc(form.ventModes.join(", "))}${form.ventModes.includes("tunnel") ? ` · fans ${esc(form.tunnelFanCount)}` : ""}</td></tr>
          <tr><td>Vent Door Type</td><td>${esc(form.ventDoorTypes.join(", "))}</td></tr>
          <tr><td>Opening / S.P.</td><td>${esc(form.ventOpeningInches)} / ${esc(form.staticPressure)}</td></tr>
          <tr><td>C.F.M./Ft2 Min Vent</td><td>${esc(form.cfmPerFt2MinVent)}</td></tr>
          <tr><td>Size and Number Of Fans Used</td><td>${esc(form.fansSizeAndCount)}</td></tr>
          <tr><td>Min Vent Timer (Actual)</td><td>${esc(formatMinVentPair(form.minVentActualOn, form.minVentActualOff))}</td></tr>
          <tr><td>Min Vent Timer (Recommended) Wk ${esc(String(form.minVentRecommendedWeek))}</td><td>${esc(formatMinVentPair(form.minVentRecommendedOn, form.minVentRecommendedOff))}</td></tr>
          <tr><td>Max C.F.M. (House 1 Total CFM)</td><td>${esc(form.maxCfm)}</td></tr>
          <tr><td>Cool Cell Off / On</td><td>${esc(form.coolCellOffTemp)} / ${esc(form.coolCellOnTemp)}</td></tr>
          <tr><td>Cool Cell Timer</td><td>${esc(form.coolCellTimerOn)}/${esc(form.coolCellTimerOff)}</td></tr>
        </table>
        <h2>SPACE / SANITATION / EMERGENCY</h2>
        <table>
          ${checkRow("Birds Are Partitioned Properly", form.partitionedOk)}
          ${checkRow("Birds Are Comfortable And Evenly Spread", form.comfortableSpreadOk)}
          ${checkRow("Premise Is Clean", form.premiseCleanOk)}
          ${checkRow("Rodenticide Is Placed", form.rodenticideOk)}
          ${checkRow("Foot Baths Are Utilized", form.footBathsOk)}
          ${checkRow("Generator Is In Auto", form.generatorAutoOk)}
          ${checkRow("Dialer Alarm Is On (Not Bypassed)", form.dialerOnOk)}
          <tr><td>Controller Alarm HI / LOW</td><td>${esc(form.alarmHi)} / ${esc(form.alarmLow)}</td></tr>
          <tr><td>Backup Heat/Cool/S1/S2/S3</td><td>${esc([form.backupHeat, form.backupCool, form.backupStage1, form.backupStage2, form.backupStage3].join(" / "))}</td></tr>
        </table>
      </div>
    </div>
    <h2>COMMENTS</h2>
    <div class="comments">${esc(form.comments)}</div>
    <div class="meta" style="margin-top:8px">Service Tech: ${esc(form.serviceTech)}</div>
  `;

  const htmlPages = pages.map((rows, idx) => {
    const isContinuation = idx > 0;
    return `<div class="page">
      <div class="meta">
        <div><strong>Farm Name:</strong> ${esc(form.farmName)}</div>
        <div><strong>Date:</strong> ${esc(form.date)}${isContinuation ? " · Continuation" : ""}</div>
      </div>
      ${houseTableHtml(rows)}
      ${isContinuation ? `<p class="muted">Continuation page — house table only.</p>` : checklist}
    </div>`;
  });

  return wrap("BACHOCO USA - SERVICE REPORT", htmlPages.join("\n"));
}

export function placementPdfHtml(form: Extract<AnyServiceForm, { kind: "placement" }>) {
  const litterPages = chunkHouses(form.houses, 8);
  const main = `
    <div class="meta">
      <div><strong>Farm Name:</strong> ${esc(form.farmName)} &nbsp; <strong>Farm #:</strong> ${esc(form.farmNumber)}</div>
      <div><strong>Flock:</strong> ${esc(form.flockNumber)} &nbsp; <strong>Date:</strong> ${esc(form.date)}</div>
    </div>
    <div class="grid2">
      <div>
        <h2>FEED</h2>
        <table>
          ${checkRow("Supplemental Feed Lids (1 per 1,000)", form.supplementalLidsOk)}
          ${checkRow("Feeder Paper Per Program", form.feederPaperOk)}
          ${checkRow("Feed Tray Ribs Are Covered", form.feedTrayRibsOk)}
          ${checkRow("Turbo Feeders Full", form.turboFeedersFullOk)}
        </table>
        <h2>LIGHT</h2>
        <table>
          ${checkRow("All Burnt Bulbs Replaced", form.bulbsReplacedOk)}
          ${checkRow("All Lights At Full Intensity", form.lightsFullIntensityOk)}
          ${checkRow("Call Pan Lights Are Fully Operational", form.callPanLightsOk)}
          ${checkRow("Brood Lights Are ON", form.broodLightsOnOk)}
        </table>
        <h2>WATER</h2>
        <table>
          ${checkRow("Sight Tubes are clean", form.sightTubesOk)}
          ${checkRow("Proxy Test Strip Test Performed", form.proxyTestOk)}
          ${checkRow("Anything Currently Added to Water", form.waterAdditive)}
          <tr><td>P.S.I Before / After</td><td>${esc(form.psiBefore)} / ${esc(form.psiAfter)}</td></tr>
          <tr><td>Inches Water Column / P.H.</td><td>${esc(resolveWaterColumnInches(form.waterColumnInches))} / ${esc(form.ph)}</td></tr>
        </table>
      </div>
      <div>
        <h2>AIR AND LITTER</h2>
        <table>
          ${checkRow("Temperature Is Set To Day 1 Target", form.tempDay1Ok)}
          ${checkRow("Litter Amendment Has Been Applied", form.litterAmendmentOk)}
          <tr><td>Amendment type</td><td>${esc(form.litterAmendmentType === "Pure7" ? "Pure 7" : form.litterAmendmentType)}</td></tr>
          ${checkRow("All Heaters Are On And Operational", form.heatersOk)}
          ${checkRow("Sensors at Bird Level", form.sensorsBirdLevelOk)}
          <tr><td>Vent Door Type</td><td>${esc(form.ventDoorTypes.join(", "))}</td></tr>
          <tr><td>Opening / S.P.</td><td>${esc(form.ventOpeningInches)} / ${esc(form.staticPressure)}</td></tr>
          <tr><td>C.F.M./Ft2 Min Vent</td><td>${esc(form.cfmPerFt2MinVent)}</td></tr>
          <tr><td>Fans</td><td>${esc(form.fansSizeAndCount)}</td></tr>
          <tr><td>Min Vent Actual</td><td>${esc(formatMinVentPair(form.minVentActualOn, form.minVentActualOff))}</td></tr>
          <tr><td>Min Vent Recommended (Wk ${esc(String(form.minVentRecommendedWeek))})</td><td>${esc(formatMinVentPair(form.minVentRecommendedOn, form.minVentRecommendedOff))}</td></tr>
        </table>
        <h2>SPACE / SANITATION / EMERGENCY</h2>
        <table>
          ${checkRow("Chicks Are Partitioned Properly", form.partitionedOk)}
          ${checkRow("Premise is clean", form.premiseCleanOk)}
          ${checkRow("Rodenticide Is Placed", form.rodenticideOk)}
          ${checkRow("Foot Baths Are Utilized", form.footBathsOk)}
          ${checkRow("Generator Is In Auto", form.generatorAutoOk)}
          ${checkRow("Dialer Alarm Is ON", form.dialerOnOk)}
          <tr><td>Alarm HI / LOW</td><td>${esc(form.alarmHi)} / ${esc(form.alarmLow)}</td></tr>
          <tr><td>Backup Heat/Cool/S1/S2/S3</td><td>${esc([form.backupHeat, form.backupCool, form.backupStage1, form.backupStage2, form.backupStage3].join(" / "))}</td></tr>
        </table>
      </div>
    </div>
    <h2>LITTER TEMP / AMMONIA BY HOUSE</h2>
    ${houseTableHtml(litterPages[0] ?? [], { litterAmmonia: true })}
    <h2>COMMENTS</h2>
    <div class="comments">${esc(form.comments)}</div>
    <div class="meta" style="margin-top:8px">Service Tech: ${esc(form.serviceTech)}</div>
  `;
  const extra = litterPages.slice(1).map(
    (rows) => `<div class="page">
      <p class="muted">Continuation — litter / ammonia by house</p>
      ${houseTableHtml(rows, { litterAmmonia: true })}
    </div>`,
  );
  return wrap("BACHOCO OK FOODS PLACEMENT CHECKLIST", main + extra.join("\n"));
}

export function prebroodPdfHtml(form: Extract<AnyServiceForm, { kind: "prebrood" }>) {
  const ammoniaPages = chunkHouses(form.houses, 8);
  const serviceDate =
    form.generatorServicedOk === "yes"
      ? formatServiceShortDate(form.generatorServiceDate)
      : "";
  const main = `
    <div class="meta">
      <div><strong>Farm Name:</strong> ${esc(form.farmName)} &nbsp; <strong>Farm #:</strong> ${esc(form.farmNumber)}</div>
      <div><strong>Flock:</strong> ${esc(form.flockNumber)} &nbsp; <strong>${esc(form.windowHours)} Hour</strong> &nbsp; <strong>Date:</strong> ${esc(form.date)}</div>
    </div>
    <div class="grid2">
      <div>
        <h2>FEED</h2>
        <table>
          ${checkRow("Feed Delivered", form.feedDeliveredOk)}
          ${checkRow("Feed Paper Delivered", form.feedPaperDeliveredOk)}
          ${checkRow("Supplemental Feed Lids Delivered", form.supplementalLidsDeliveredOk)}
        </table>
        <h2>LIGHT</h2>
        <table>
          ${checkRow("All Burnt Bulbs Replaced", form.bulbsReplacedOk)}
          ${checkRow("Lighting Program Is Present", form.lightingProgramOk)}
        </table>
        <h2>WATER</h2>
        <table>
          ${checkRow("Sight Tubes are clean", form.sightTubesOk)}
          ${checkRow("Water Lines have been Sanitized", form.waterLinesSanitizedOk)}
        </table>
        <h2>SANITATION</h2>
        <table>
          ${checkRow("Premise is clean", form.premiseCleanOk)}
          ${checkRow("Current Insecticide Has Been Applied", form.insecticideOk)}
          <tr><td>Insecticide type</td><td>${esc(form.insecticideType)}</td></tr>
        </table>
      </div>
      <div>
        <h2>AIR AND LITTER</h2>
        <table>
          ${checkRow("Is Moisture Removal Chart Present", form.moistureChartOk)}
          ${checkRow("Litter Amendment Has Been Applied", form.litterAmendmentOk)}
          <tr><td>Amendment type</td><td>${esc(form.litterAmendmentType === "Pure7" ? "Pure 7" : form.litterAmendmentType)}</td></tr>
          ${checkRow("Min Vent Is ON", form.minVentOnOk)}
          ${checkRow("Fans Are Clean", form.fansCleanOk)}
          ${checkRow("Temperature Is Set To Day 1 Target", form.tempDay1Ok)}
          ${checkRow("Proper Cake Out Has Been Completed", form.cakeOutOk)}
          ${checkRow("Clean Out and Pad Treat", form.cleanOutPadTreatOk)}
          ${checkRow("Litter Depth is Adequate (Min 4-6\")", form.litterDepthOk)}
          ${checkRow("All Heaters Are On And Operational", form.heatersOk)}
        </table>
        <h2>EMERGENCY</h2>
        <table>
          ${checkRow("Generator Block Heater", form.blockHeaterOk)}
          ${checkRow("Generator Battery Maintainer", form.batteryMaintainerOk)}
          ${checkRow("Performed Generator Test", form.generatorTestOk)}
          ${checkRow("Performed Dialer Alarm Test", form.dialerTestOk)}
          <tr><td>Generator Serviced</td><td>${esc(yn(form.generatorServicedOk))}${serviceDate ? ` · ${esc(serviceDate)}` : ""}</td></tr>
        </table>
      </div>
    </div>
    <h2>CURRENT AMMONIA LEVEL (PPM) BY HOUSE</h2>
    ${houseTableHtml(ammoniaPages[0] ?? [], { litterAmmonia: true })}
    <h2>COMMENTS</h2>
    <div class="comments">${esc(form.comments)}</div>
    <div class="meta" style="margin-top:8px">Service Tech: ${esc(form.serviceTech)}</div>
  `;
  const extra = ammoniaPages.slice(1).map(
    (rows) => `<div class="page">
      <p class="muted">Continuation — ammonia by house</p>
      ${houseTableHtml(rows, { litterAmmonia: true })}
    </div>`,
  );
  return wrap("BACHOCO OK FOODS 48-72 HOUR PREBROOD CHECKLIST", main + extra.join("\n"));
}

export function serviceFormPdfHtml(form: AnyServiceForm) {
  if (form.kind === "service_report") return serviceReportPdfHtml(form);
  if (form.kind === "placement") return placementPdfHtml(form);
  return prebroodPdfHtml(form);
}
