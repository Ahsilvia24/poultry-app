/** Home Screen iOS (standalone PWA). Opening a blob URL here leaves the app and comes back glitchy. */
export function isHomeScreenApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

export function isShareAbort(err: unknown) {
  return Boolean(
    err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError",
  );
}

export function pdfFileFromBytes(bytes: Uint8Array, filename: string): File {
  const name = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

type ShareNav = Navigator & {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as ShareNav;
  if (typeof nav.canShare !== "function" || typeof nav.share !== "function") return false;
  try {
    return nav.canShare({ files });
  } catch {
    return false;
  }
}

/** Share the File itself. Never pass a URL or text — iOS Messages would add a body. */
export async function shareFiles(files: File[], _title?: string): Promise<boolean> {
  if (!canShareFiles(files)) return false;
  const nav = navigator as ShareNav;
  try {
    await nav.share({ files });
    return true;
  } catch (err) {
    return isShareAbort(err);
  }
}
