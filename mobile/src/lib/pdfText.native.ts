/**
 * Native PDF text extraction via PDFKit (iOS) / PDFBox (Android).
 * Digital/text PDFs work on a native install; scanned image PDFs need CSV/XLSX
 * (OCR stays on Expo web).
 */

import * as FileSystem from "expo-file-system/legacy";
import {
  extractText,
  extractTextFromPage,
  getPageCount,
  isAvailable,
} from "expo-pdf-text-extract";

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
  // ASCII-only name — PDFKit URL(string:) is fragile with spaces / encoding.
  const uri = `${dir}placement-import-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

function toFilesystemPath(uri: string): string {
  if (uri.startsWith("file://")) {
    try {
      return decodeURIComponent(uri.replace(/^file:\/\//, ""));
    } catch {
      return uri.replace(/^file:\/\//, "");
    }
  }
  return uri;
}

/**
 * Prefer page-by-page extract with clear separators so page-boundary glue
 * cannot hide rows from the Weekly Chick Placement parser.
 */
async function extractPagedText(pathOrUri: string): Promise<string> {
  try {
    const pages = await getPageCount(pathOrUri);
    if (pages > 1) {
      const parts: string[] = [];
      for (let page = 1; page <= pages; page++) {
        const pageText = await extractTextFromPage(pathOrUri, page);
        if (pageText?.trim()) parts.push(pageText.replace(/\u0000/g, ""));
      }
      if (parts.length > 0) {
        return parts.join("\n\n---PAGE---\n\n");
      }
    }
  } catch {
    // Fall through to whole-document extract.
  }
  return (await extractText(pathOrUri)).replace(/\u0000/g, "");
}

async function extractFromUri(uri: string): Promise<string> {
  if (!isAvailable()) {
    throw new Error(
      "PDF import needs the installed PoultryTech app. Reinstall from the App Store, or use CSV/XLSX.",
    );
  }

  // Prefer a plain filesystem path — more reliable than file:// for PDFKit.
  const path = toFilesystemPath(uri);
  let text = "";
  try {
    text = await extractPagedText(path);
  } catch {
    // Fall back to original URI (some Android content:// paths need it).
    text = await extractPagedText(uri);
  }

  if (!text.trim()) {
    throw new Error(
      "No readable text in this PDF (likely a scan). Use a text PDF, or import CSV/XLSX.",
    );
  }
  return text;
}

/**
 * Copy the picker URI into an ASCII cache file, then extract.
 * Avoids PDFKit failures on DocumentPicker names with spaces.
 */
export async function extractPdfTextFromUri(uri: string): Promise<string> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return extractFromUri(uri);

  const safeUri = `${dir}placement-import-${Date.now()}.pdf`;
  try {
    await FileSystem.copyAsync({ from: uri, to: safeUri });
    return await extractFromUri(safeUri);
  } catch {
    return extractFromUri(uri);
  } finally {
    await FileSystem.deleteAsync(safeUri, { idempotent: true }).catch(() => undefined);
  }
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
