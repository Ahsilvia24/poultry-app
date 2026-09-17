/** Bachoco checklist templates. Share PDF reads these from the phone cache. */
export const SERVICE_FORM_TEMPLATE_URLS = [
  "/service-forms/placement.pdf",
  "/service-forms/prebrood.pdf",
  "/service-forms/service-report.pdf",
] as const;

export function collectWarmAssetUrls(): string[] {
  const urls = new Set<string>(SERVICE_FORM_TEMPLATE_URLS);
  if (typeof document === "undefined") return [...urls];
  for (const el of document.querySelectorAll("script[src]")) {
    if (el instanceof HTMLScriptElement && el.src) urls.add(el.src);
  }
  for (const el of document.querySelectorAll("link[href]")) {
    if (!(el instanceof HTMLLinkElement) || !el.href) continue;
    if (el.rel === "stylesheet" || el.rel === "modulepreload" || el.rel === "preload") {
      urls.add(el.href);
    }
  }
  return [...urls];
}

function postPrecache(urls: string[]) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
    navigator.serviceWorker?.ready
      .then((ready) => ready.active?.postMessage({ type: "precache", urls }))
      .catch(() => undefined);
    return;
  }
  navigator.serviceWorker.controller.postMessage({ type: "precache", urls });
}

/** After a Wi-Fi open, save checklist templates and the import reader on the phone. */
export async function warmOfflineAssets() {
  if (typeof window === "undefined") return;
  postPrecache([...SERVICE_FORM_TEMPLATE_URLS]);
  await Promise.all(
    SERVICE_FORM_TEMPLATE_URLS.map((url) =>
      fetch(url, { credentials: "same-origin" }).catch(() => undefined),
    ),
  );
  try {
    await import("@/lib/pdf-text-extract-client");
    // The extract module loads unpdf only when a file is read. Pull it now
    // so Placement/Catch import does not wait for a field-side download.
    await import("unpdf");
  } catch {
    // First download needs service. Share/import still work after the next Wi-Fi open.
  }
  try {
    await import("@/lib/serviceForms/sharePdf");
  } catch {
    // pdf-lib + fill code. Same Wi-Fi open as the templates.
  }
  postPrecache(collectWarmAssetUrls());
}
