import { Platform } from "react-native";

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; useSystemFonts?: boolean; isEvalSupported?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number }> }>;
      }>;
    }>;
  };
};

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/**
 * Load pdf.js as a native browser ESM from /public.
 * Avoids Metro bundling (pdf.js uses import.meta, which crashes Expo web).
 */
function loadPdfJs(): Promise<PdfJsModule> {
  if (pdfjsPromise) return pdfjsPromise;

  if (Platform.OS !== "web" || typeof window === "undefined") {
    return Promise.reject(
      new Error("PDF text extract runs in the browser. Use CSV/XLSX on native, or open Expo web."),
    );
  }

  const origin = window.location.origin;
  const moduleUrl = `${origin}/pdf.min.mjs`;
  const workerUrl = `${origin}/pdf.worker.min.mjs`;

  // new Function keeps Metro from rewriting this into a static bundle import.
  pdfjsPromise = (new Function("url", "return import(url)") as (url: string) => Promise<PdfJsModule>)(
    moduleUrl,
  ).then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });

  return pdfjsPromise;
}

type TextSpan = { str: string; x: number; y: number };

function spansToLines(spans: TextSpan[]): string[] {
  if (spans.length === 0) return [];
  // PDF y often increases upward; sort top-to-bottom then left-to-right.
  const sorted = [...spans].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; parts: TextSpan[] }> = [];

  for (const span of sorted) {
    const line = lines.find((l) => Math.abs(l.y - span.y) <= 3.5);
    if (line) {
      line.parts.push(span);
      line.y = (line.y * (line.parts.length - 1) + span.y) / line.parts.length;
    } else {
      lines.push({ y: span.y, parts: [span] });
    }
  }

  return lines.map((line) => {
    const parts = [...line.parts].sort((a, b) => a.x - b.x);
    let out = "";
    let lastRight = -Infinity;
    for (const part of parts) {
      const gap = part.x - lastRight;
      if (out) {
        if (gap > 14) out += "\t";
        else if (gap > 2.5 && !/\s$/.test(out) && !/^\s/.test(part.str)) out += " ";
      }
      out += part.str;
      lastRight = part.x + Math.max(part.str.length * 4.5, 4);
    }
    return out.trimEnd();
  });
}

/**
 * Extract plain text from a PDF via pdfjs-dist (browser ESM from /public).
 * Keeps row/column spacing so Placement / Catch parsers can read tables.
 */
export async function extractPdfTextFromBytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const pdfjs = await loadPdfJs();

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const spans: TextSpan[] = [];

    for (const item of content.items) {
      if (!item || typeof item !== "object") continue;
      const str = String(item.str ?? "");
      if (!str.trim()) continue;
      const transform = item.transform;
      if (!Array.isArray(transform)) continue;
      spans.push({
        str,
        x: Number(transform[4]) || 0,
        y: Number(transform[5]) || 0,
      });
    }

    parts.push(...spansToLines(spans));
    parts.push("");
  }

  return parts.join("\n");
}
