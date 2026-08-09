/**
 * Fallback module for TypeScript resolution.
 * Metro uses pdfText.web.ts / pdfText.native.ts at bundle time.
 */

export async function extractPdfTextFromUri(_uri: string): Promise<string> {
  throw new Error("PDF extract platform module failed to load.");
}

export async function extractPdfTextFromBytes(
  _bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  throw new Error("PDF extract platform module failed to load.");
}
