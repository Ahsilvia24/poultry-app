import { PDFDocument } from "pdf-lib";

/**
 * Checklist PDFs are scanned form pages (images). iOS Messages will MMS those
 * to green-bubble phones. A tiny text-only PDF stays iMessage-only.
 */
export async function pdfBytesFromJpegPages(
  pages: Array<{ bytes: Uint8Array; width: number; height: number }>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const page of pages) {
    if (page.bytes.byteLength === 0) continue;
    const image = await doc.embedJpg(page.bytes);
    const sheet = doc.addPage([page.width, page.height]);
    sheet.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
  }
  if (doc.getPageCount() === 0) {
    throw new Error("Could not make the PDF page.");
  }
  return doc.save({ updateFieldAppearances: false });
}

export async function jpegBytesFromCanvas(
  canvas: HTMLCanvasElement,
  quality = 0.86,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error("Could not make the PDF page."))),
      "image/jpeg",
      quality,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}
