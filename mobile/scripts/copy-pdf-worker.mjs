import { copyFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public");
const files = [
  ["node_modules/pdfjs-dist/legacy/build/pdf.min.mjs", "pdf.min.mjs"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
];

mkdirSync(destDir, { recursive: true });

for (const [relSrc, name] of files) {
  const src = path.join(root, relSrc);
  const dest = path.join(destDir, name);
  if (!existsSync(src)) {
    console.warn(`[copy-pdf-worker] missing ${relSrc}; skip`);
    continue;
  }
  copyFileSync(src, dest);
  console.log("[copy-pdf-worker] wrote", dest);
}
