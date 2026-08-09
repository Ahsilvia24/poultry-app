import { Platform } from "react-native";

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; useSystemFonts?: boolean; isEvalSupported?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
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

/**
 * Extract plain text from a PDF via pdfjs-dist (browser ESM from /public).
 * Used for Placement and Catch Schedule PDF imports on Expo web.
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
    let line = "";
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!item || typeof item !== "object") continue;
      const str = String(item.str ?? "");
      if (!str) continue;
      const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;

      if (lastY != null && y != null && Math.abs(lastY - y) > 2.5) {
        parts.push(line.trimEnd());
        line = "";
      }

      if (line && !/\s$/.test(line) && !/^\s/.test(str)) {
        line += " ";
      }
      line += str;
      lastY = y ?? lastY;
    }

    if (line.trim()) parts.push(line.trimEnd());
    parts.push("");
  }

  return parts.join("\n");
}
