import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { minVentSideBoxes, recommendedWeekLabel, WEEK_OPTIONS } from "./minVentLabel.ts";
import { normalizeVentDoorTypes, ventDoorTypesFromPayload } from "./ventDoor.ts";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, "../../../assets/service-forms");
const workerSrc = pathToFileURL(
  join(here, "../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

describe("normalizeVentDoorTypes", () => {
  it("keeps a multi-select array", () => {
    assert.deepEqual(normalizeVentDoorTypes(["sidewall", "ceiling"]), [
      "sidewall",
      "ceiling",
    ]);
  });

  it("lifts a leftover single string from older saved forms", () => {
    assert.deepEqual(normalizeVentDoorTypes("ceiling"), ["ceiling"]);
    assert.deepEqual(normalizeVentDoorTypes(""), []);
  });

  it("drops unknown values", () => {
    assert.deepEqual(normalizeVentDoorTypes(["ceiling", "both", "sidewall"]), [
      "ceiling",
      "sidewall",
    ]);
  });
});

describe("WEEK_OPTIONS", () => {
  it("includes blank plus weeks 1–8", () => {
    assert.equal(WEEK_OPTIONS[0]?.value, "");
    assert.equal(WEEK_OPTIONS[0]?.label, "Blank");
    assert.equal(WEEK_OPTIONS.length, 9);
  });
});

describe("minVentSideBoxes", () => {
  it("splits a printed slash box into left and right halves", () => {
    const boxes = minVentSideBoxes({ x: 200, w: 80 }, 4);
    assert.equal(boxes.mid, 240);
    assert.equal(boxes.left.x, 200);
    assert.equal(boxes.left.w, 36);
    assert.equal(boxes.right.x, 244);
    assert.equal(boxes.right.w, 36);
  });

  it("stamps on/off as two numbers with no extra slash", async () => {
    GlobalWorkerOptions.workerSrc = workerSrc;
    const map = JSON.parse(readFileSync(join(assetsDir, "placement-fields.json"), "utf8")) as {
      fields: Record<string, { widgets: { x: number; y: number; w: number; h: number }[] }>;
    };
    const doc = await PDFDocument.load(readFileSync(join(assetsDir, "placement.pdf")));
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.getPages()[0]!;
    for (const [name, on, off] of [
      ["Text71", "14", "286"],
      ["Text88", "30", "270"],
    ] as const) {
      const r = map.fields[name]!.widgets[0]!;
      const size = 7;
      const { left: leftBox, right: rightBox, mid } = minVentSideBoxes(r);
      const onW = font.widthOfTextAtSize(on, size);
      const onX = Math.max(leftBox.x + 0.5, leftBox.x + leftBox.w - onW);
      assert.ok(onX + onW <= mid, `${name} on stays left of the printed slash`);
      assert.ok(rightBox.x >= mid, `${name} off starts right of the printed slash`);
      page.drawText(on, { x: onX, y: r.y, size, font, color: rgb(0, 0, 0) });
      page.drawText(off, { x: rightBox.x, y: r.y, size, font, color: rgb(0, 0, 0) });
    }
    const bytes = await doc.save({ updateFieldAppearances: false });
    const pdf = await getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;
    const content = await (await pdf.getPage(1)).getTextContent();
    const items = content.items
      .map((item) => {
        const row = item as { str?: string; transform?: number[] };
        return { str: row.str ?? "", x: row.transform?.[4] ?? 0 };
      })
      .filter((item) => item.str.trim());
    assert.deepEqual(
      items.map((item) => item.str),
      ["14", "286", "30", "270"],
    );
    const actualMid = minVentSideBoxes(map.fields.Text71!.widgets[0]!).mid;
    const recMid = minVentSideBoxes(map.fields.Text88!.widgets[0]!).mid;
    assert.ok(items[0]!.x < actualMid && items[1]!.x > actualMid);
    assert.ok(items[2]!.x < recMid && items[3]!.x > recMid);
  });
});

describe("recommendedWeekLabel", () => {
  it("shows Blank when no week is selected", () => {
    assert.equal(recommendedWeekLabel(""), "Blank");
    assert.equal(recommendedWeekLabel(3), "Week 3");
  });
});

describe("ventDoorTypesFromPayload", () => {
  it("prefers the new array field", () => {
    assert.deepEqual(
      ventDoorTypesFromPayload({
        ventDoorTypes: ["ceiling", "sidewall"],
        ventDoorType: "ceiling",
      }),
      ["ceiling", "sidewall"],
    );
  });

  it("falls back to the old single field", () => {
    assert.deepEqual(ventDoorTypesFromPayload({ ventDoorType: "sidewall" }), [
      "sidewall",
    ]);
  });
});
