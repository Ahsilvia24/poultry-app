/**
 * Browser / phone extract. Start the pdf.js reader as soon as this module
 * loads with the dashboard, and ask the bundler to keep it in that same
 * download so import does not fetch a leftover chunk offline.
 */
import {
  definePDFJSModule,
  extractText,
  extractTextItems,
  getDocumentProxy,
} from "unpdf";

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

async function loadUnpdfPdfjs() {
  try {
    return await import(/* webpackMode: "eager" */ "unpdf/pdfjs");
  } catch {
    const { pathToFileURL } = await import("node:url");
    const { join } = await import("node:path");
    return import(pathToFileURL(join(process.cwd(), "node_modules/unpdf/dist/pdfjs.mjs")).href);
  }
}

const pdfjsReady = definePDFJSModule(() => loadUnpdfPdfjs());

export async function extractPdfTextsOnDevice(bytes: Uint8Array): Promise<string[]> {
  await pdfjsReady;
  const pdf = await getDocumentProxy(copyBytes(bytes));
  try {
    const texts: string[] = [];
    const merged = await extractText(pdf, { mergePages: true });
    if (merged.text.trim()) texts.push(merged.text);
    const structured = await extractTextItems(pdf);
    const pages = structured.items.map((page) =>
      page
        .map((item) => item.str)
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    );
    const fromItems = pages.join("\n\n---PAGE---\n\n");
    if (fromItems.trim()) texts.push(fromItems);
    return texts;
  } finally {
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}
