/**
 * Native PDF text extraction via PDFKit (iOS) / PDFBox (Android).
 * Digital/text PDFs work on TestFlight; scanned image PDFs need CSV/XLSX
 * (OCR stays on Expo web).
 */

import * as FileSystem from "expo-file-system/legacy";
import { extractText, isAvailable } from "expo-pdf-text-extract";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return globalThis.btoa(binary);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += BASE64_ALPHABET[(triple >> 18) & 63];
    out += BASE64_ALPHABET[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : "=";
  }
  return out;
}

async function writeBytesToCache(bytes: Uint8Array): Promise<string> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error("No cache directory available for PDF import.");
  const uri = `${dir}import-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

async function extractFromUri(uri: string): Promise<string> {
  if (!isAvailable()) {
    throw new Error(
      "PDF import needs a native build (TestFlight). Reinstall the latest build, or use CSV/XLSX.",
    );
  }
  const text = await extractText(uri);
  if (!text.trim()) {
    throw new Error(
      "No readable text in this PDF (likely a scan). On iPhone use a text PDF, or export CSV/XLSX. OCR for scans is available in Expo web.",
    );
  }
  return text;
}

/** Preferred native entry — DocumentPicker already gives a file URI. */
export async function extractPdfTextFromUri(uri: string): Promise<string> {
  return extractFromUri(uri);
}

/** Fallback when only bytes are available. */
export async function extractPdfTextFromBytes(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const uri = await writeBytesToCache(data);
  try {
    return await extractFromUri(uri);
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
