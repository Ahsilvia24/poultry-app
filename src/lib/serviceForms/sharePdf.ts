import type { AnyServiceForm } from "./types";
import { buildServiceFormPdf } from "./pdfFill";

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

/** Build a PDF on the original Bachoco form template and download it. */
export async function shareServiceFormPdf(form: AnyServiceForm) {
  const { bytes, filename } = await buildServiceFormPdf(form);
  downloadPdfBytes(bytes, filename);
  return filename;
}
