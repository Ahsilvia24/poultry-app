import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceReportDraft } from "../src/lib/serviceForms/defaults.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

for (const rel of ["src/lib/serviceForms/pdfFill.ts", "mobile/src/lib/serviceForms/pdfFill.ts"]) {
  const src = read(rel);
  assert.match(src, /setText\(ctx, "Text45", data\.lightsOffAt, 8, \{ align: "center", yNudge: 2\.5 \}\)/);
  assert.doesNotMatch(src, /Text45[\s\S]{0,80}xNudge: -14/);
  assert.match(src, /setText\(ctx, "PSI before", data\.psiBefore, 8, \{ xPad: 6 \}\)/);
  assert.match(src, /setText\(ctx, "PSI after", data\.psiAfter, 8, \{ xPad: 6 \}\)/);
}

const { buildServiceFormPdf } = await import(join(root, "src/lib/serviceForms/pdfFill.ts"));
const form = createServiceReportDraft({ farmName: "Maple" });
form.lightsOffAt = "22:00";
form.psiBefore = "45";
form.psiAfter = "27";
const built = await buildServiceFormPdf(form);
const outDir = join(tmpdir(), "pdf-box-left-pad");
mkdirSync(outDir, { recursive: true });
const pdfPath = join(outDir, "pad.pdf");
writeFileSync(pdfPath, built.bytes);
const render = spawnSync("pdftoppm", ["-png", "-r", "200", "-f", "1", "-l", "1", pdfPath, join(outDir, "page")], {
  encoding: "utf8",
});
assert.equal(render.status, 0, render.stderr);

const measure = spawnSync(
  "python3",
  [
    "-c",
    `
from PIL import Image
im = Image.open(${JSON.stringify(join(outDir, "page-1.png"))}).convert("RGB")
s = 200 / 72
page_h = 792

def first_ink(x0, x1, pdf_y, skip_left=2.2):
    iy = int(round((page_h - pdf_y) * s))
    for pdf_x in [x0 + i * 0.25 for i in range(int((x1 - x0) * 4))]:
        if pdf_x < x0 + skip_left:
            continue
        ix = int(round(pdf_x * s))
        r, g, b = im.getpixel((ix, iy))
        if r < 90:
            return pdf_x
    return None

off = first_ink(530.784, 560, 521)
before = first_ink(470.402, 500, 361)
after = first_ink(470.402, 500, 350)
print(off, before, after)
`,
  ],
  { encoding: "utf8" },
);
assert.equal(measure.status, 0, measure.stderr);
const [off, before, after] = measure.stdout.trim().split(" ").map(Number);
assert.ok(off - 530.784 > 3, `lights off still on the left line: ${off}`);
assert.ok(before - 470.402 > 3, `psi before still on the left line: ${before}`);
assert.ok(after - 470.402 > 3, `psi after still on the left line: ${after}`);

console.log("pdf-box-left-pad: ok");
