/**
 * Extract plain text from a PDF via pdfjs-dist.
 * Used for Placement and Catch Schedule PDF imports on Expo web/native.
 */
export async function extractPdfTextFromBytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // pdf.js requires a workerSrc; CDN matches the installed package version.
  const version = (pdfjs as { version?: string }).version || "4.10.38";
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
  }

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
      if (!item || typeof item !== "object" || !("str" in item)) continue;
      const str = String((item as { str?: string }).str ?? "");
      if (!str) continue;
      const transform = (item as { transform?: number[] }).transform;
      const y = Array.isArray(transform) ? Number(transform[5]) : null;

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
