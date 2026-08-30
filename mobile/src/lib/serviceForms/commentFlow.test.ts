import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  PLACEMENT_COMMENT_FIELDS,
  commentPageCount,
  consumeCommentLines,
} from "./commentFlow.ts";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../assets/service-forms");

const charWidth = (text: string) => text.length;
const tenShortLines = Array.from({ length: 10 }, () => 20);

describe("consumeCommentLines", () => {
  it("fits a short comment on one sheet", () => {
    const { lines, rest } = consumeCommentLines("House 1 looks good", [40, 40], charWidth);
    assert.equal(lines.join(" "), "House 1 looks good");
    assert.equal(rest, "");
    assert.equal(commentPageCount("House 1 looks good", tenShortLines, charWidth), 1);
  });

  it("returns leftover words for the next placement sheet", () => {
    const words = Array.from({ length: 80 }, (_, i) => `w${i}`);
    const { rest } = consumeCommentLines(words.join(" "), [8, 8, 8], charWidth);
    assert.ok(rest.startsWith("w"));
    assert.ok(!rest.includes("w0 "));
    assert.notEqual(rest, "");
  });

  it("needs extra placement pages when comments fill more than ten lines", () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`);
    const pages = commentPageCount(words.join(" "), tenShortLines, charWidth);
    assert.ok(pages >= 2);
    assert.ok(pages <= 12);
    assert.equal(PLACEMENT_COMMENT_FIELDS.length, 10);
  });

  it("continues leftover comments on a second stamped sheet", async () => {
    const map = JSON.parse(readFileSync(join(assetsDir, "placement-fields.json"), "utf8")) as {
      fields: Record<string, { widgets: { w: number }[] }>;
    };
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const widths = PLACEMENT_COMMENT_FIELDS.map((name) => {
      const w = map.fields[name]?.widgets[0]?.w ?? 500;
      return Math.max(40, w * 0.92);
    });
    const measure = (text: string) => font.widthOfTextAtSize(text, 8);
    const words = Array.from({ length: 250 }, (_, i) => `note${i}`);
    const text = words.join(" ");
    assert.equal(commentPageCount(text, widths, measure), 2);
    const first = consumeCommentLines(text, widths, measure);
    assert.ok(first.rest.startsWith("note"));
    const second = consumeCommentLines(first.rest, widths, measure);
    assert.equal(second.rest, "");
    assert.ok(text.startsWith(first.lines[0]!));
    assert.ok(first.rest.startsWith(second.lines[0]!));
  });
});
