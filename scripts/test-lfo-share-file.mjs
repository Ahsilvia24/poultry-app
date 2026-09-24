import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const shares = [];
let canShareFiles = true;
const downloads = [];

const navStub = {
  standalone: true,
  canShare: (data) => canShareFiles && Array.isArray(data?.files) && data.files.length > 0,
  share: async (data) => {
    if (data?.url) throw new Error("must not share a URL");
    shares.push(data);
  },
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: navStub });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: true }),
    navigator: navStub,
  },
});

const {
  canShareFiles: canShare,
  isHomeScreenApp,
  isShareAbort,
  pdfFileFromBytes,
  shareFiles,
} = await import(join(root, "src/lib/exports/share-file.ts"));

assert.equal(isHomeScreenApp(), true);
assert.equal(isShareAbort({ name: "AbortError" }), true);
assert.equal(isShareAbort(new Error("no")), false);

const file = pdfFileFromBytes(new Uint8Array([37, 80, 68, 70]), "Oak Ridge LFO");
assert.equal(file.name, "Oak Ridge LFO.pdf");
assert.equal(file.type, "application/pdf");
assert.equal(canShare([file]), true);
assert.equal(await shareFiles([file], "Oak Ridge LFO"), true);
assert.equal(shares.length, 1);
assert.equal(shares[0].url, undefined);
assert.equal(shares[0].files[0].name, "Oak Ridge LFO.pdf");
assert.ok(!("url" in shares[0]));

shares.length = 0;
navStub.share = async () => {
  const err = new Error("Share canceled");
  err.name = "AbortError";
  throw err;
};
assert.equal(await shareFiles([file], "Oak Ridge LFO"), true);

canShareFiles = false;
assert.equal(canShare([file]), false);
assert.equal(await shareFiles([file], "Oak Ridge LFO"), false);

const sharePdf = read("src/lib/serviceForms/sharePdf.ts");
assert.match(sharePdf, /export async function sharePdfBytes/);
assert.match(sharePdf, /shareFiles\(\[file\]/);
assert.match(sharePdf, /isHomeScreenApp\(\)/);
assert.doesNotMatch(sharePdf, /url:/);

const lfoPdf = read("src/lib/exports/lfo-pdf.ts");
assert.match(lfoPdf, /sharePdfBytes/);
assert.match(lfoPdf, /export async function shareLfoPdf/);
assert.doesNotMatch(lfoPdf, /downloadPdfBytes/);

const row = read("src/components/SavedLfoRow.tsx");
assert.match(row, /shareLfoPdf/);
assert.match(row, /holdRowLink/);
assert.match(row, /pointer-events-none/);
assert.doesNotMatch(row, /downloadLfoPdf/);
assert.doesNotMatch(row, /router\.(push|replace|back)/);

void downloads;

console.log("lfo-share-file: ok");
