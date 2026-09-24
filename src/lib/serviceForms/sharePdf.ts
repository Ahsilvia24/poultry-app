import { PDFDocument } from "pdf-lib";
import { isHomeScreenApp, pdfFileFromBytes, shareFiles } from "@/lib/exports/share-file";
import { formatServiceShortDate } from "./format";
import type { BuiltServicePdf } from "./pdfFill";
import { buildServiceFormPdf } from "./pdfFill";
import type { AnyServiceForm } from "./types";

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Hand the PDF file to the iOS share sheet. Stay in the app — do not open a
 * blob URL (that is what shares a link and makes the return glitchy).
 */
export async function sharePdfBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<"share" | "download" | "stay"> {
  const file = pdfFileFromBytes(bytes, filename);
  if (await shareFiles([file], file.name.replace(/\.pdf$/i, ""))) return "share";
  if (isHomeScreenApp()) return "stay";
  downloadPdfBytes(bytes, filename);
  return "download";
}

/** Build a PDF on the original Bachoco form template and download it. */
export async function shareServiceFormPdf(form: AnyServiceForm) {
  const { bytes, filename } = await buildServiceFormPdf(form);
  downloadPdfBytes(bytes, filename);
  return filename;
}

export function mergedServiceFormsFilename(forms: AnyServiceForm[]) {
  const dates = forms
    .map((form) => String(form.date || "").trim())
    .filter(Boolean)
    .sort();
  const from = dates[0] || "";
  const to = dates[dates.length - 1] || from;
  const day = formatServiceShortDate(from) || from || "date";
  const prefix = from && to && from !== to ? "Weekly Reports" : "All Reports";
  return `${prefix} ${day}.pdf`;
}

/** Combine every checklist into one PDF so Share All is a single download. */
export async function buildMergedServiceFormsPdf(
  forms: AnyServiceForm[],
): Promise<BuiltServicePdf> {
  if (forms.length === 0) {
    throw new Error("No checklists to share.");
  }
  if (forms.length === 1) {
    return buildServiceFormPdf(forms[0]!);
  }

  const merged = await PDFDocument.create();
  for (const form of forms) {
    const built = await buildServiceFormPdf(form);
    const src = await PDFDocument.load(built.bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  const bytes = await merged.save({ updateFieldAppearances: false });
  return { uri: "", bytes, filename: mergedServiceFormsFilename(forms) };
}

/** Share every checklist in one PDF. Sequential a.click() downloads drop all but the first on iOS. */
export async function shareServiceFormsPdf(forms: AnyServiceForm[]) {
  const { bytes, filename } = await buildMergedServiceFormsPdf(forms);
  downloadPdfBytes(bytes, filename);
  return filename;
}
