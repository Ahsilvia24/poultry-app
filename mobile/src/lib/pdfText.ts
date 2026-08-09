import { Platform } from "react-native";

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; useSystemFonts?: boolean; isEvalSupported?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<PdfJsPage>;
    }>;
  };
};

type PdfJsPage = {
  getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number }> }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas?: HTMLCanvasElement;
  }) => { promise: Promise<void> };
};

type TesseractMod = {
  createWorker: (
    lang?: string,
    oem?: number,
    options?: Record<string, string>,
  ) => Promise<{
    recognize: (image: HTMLCanvasElement | string) => Promise<{ data: { text: string } }>;
    terminate: () => Promise<void>;
  }>;
};

let pdfjsPromise: Promise<PdfJsModule> | null = null;

function pdfTextNeedsOcr(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 40) return true;
  const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text);
  const hasFarmCode = /\d{3,5}[A-Z]{2}/i.test(text);
  return !hasDate && !hasFarmCode;
}

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

async function loadTesseract(): Promise<TesseractMod> {
  // CDN ESM — avoids Metro + works with COEP credentialless (jsDelivr sends CORP).
  return (new Function("url", "return import(url)") as (url: string) => Promise<TesseractMod>)(
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js",
  );
}

type TextSpan = { str: string; x: number; y: number };

function spansToLines(spans: TextSpan[]): string[] {
  if (spans.length === 0) return [];
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

async function extractTextLayer(
  pdf: { numPages: number; getPage: (n: number) => Promise<PdfJsPage> },
): Promise<string> {
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

async function ocrPdfPages(
  pdf: { numPages: number; getPage: (n: number) => Promise<PdfJsPage> },
  maxPages = 6,
): Promise<string> {
  const tesseract = await loadTesseract();
  const worker = await tesseract.createWorker("eng", 1, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js",
    langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int",
  });

  try {
    const parts: string[] = [];
    const pageCount = Math.min(pdf.numPages, maxPages);
    for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const { data } = await worker.recognize(canvas);
      if (data.text.trim()) parts.push(data.text.trim());
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

/**
 * Extract plain text from a PDF via pdf.js.
 * Falls back to on-device OCR (tesseract.js) for scanned / image-only PDFs.
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

  const textLayer = await extractTextLayer(pdf);
  if (!pdfTextNeedsOcr(textLayer)) return textLayer;

  try {
    const ocr = await ocrPdfPages(pdf);
    if (ocr.trim()) return ocr;
  } catch (e) {
    if (textLayer.trim()) return textLayer;
    throw new Error(
      e instanceof Error
        ? `Scanned PDF OCR failed: ${e.message}`
        : "Scanned PDF OCR failed. Try CSV/XLSX export.",
    );
  }

  return textLayer;
}
