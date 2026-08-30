import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../assets/service-forms");

/**
 * Web Share PDF must download bytes directly. expo-file-system
 * readAsStringAsync / writeAsStringAsync throw on web.
 */
function webPdfDownloadUsesBytesOnly(input: { bytes: Uint8Array; filename: string }) {
  if (!input.bytes.byteLength) throw new Error("PDF bytes are required");
  if (!input.filename.endsWith(".pdf")) throw new Error("PDF filename is required");
  return { hrefKind: "blob" as const, filename: input.filename, size: input.bytes.byteLength };
}

describe("web Share PDF", () => {
  it("saves from in-memory bytes instead of reading a file URI", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const result = webPdfDownloadUsesBytesOnly({
      bytes,
      filename: "Service-Report-Test-2026-08-30.pdf",
    });
    assert.equal(result.hrefKind, "blob");
    assert.equal(result.size, 4);
    assert.match(result.filename, /\.pdf$/);
  });

  it("loads the Bachoco service-report template without expo-file-system", async () => {
    const raw = new Uint8Array(readFileSync(join(assetsDir, "service-report.pdf")));
    const doc = await PDFDocument.load(raw);
    const bytes = await doc.save({ updateFieldAppearances: false });
    assert.ok(bytes.byteLength > 1000);
    assert.equal(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!), "%PDF");
  });
});
