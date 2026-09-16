/** Word joiner — invisible, stops iOS from treating "WP: …" as a URL scheme. */
const NO_SCHEME = "\u2060";

const SCHEME_AT_START = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/** Decode a line that was URL-encoded as one token (spaces → %20, : → %3A). */
export function decodeCopiedLine(text: string): string {
  const raw = String(text ?? "").replace(/^\u2060/, "");
  if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
  if (/\s/.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Plain clipboard body: abbreviations + numbers, never a URL. */
export function plainClipboardText(text: string): string {
  const value = decodeCopiedLine(text);
  if (SCHEME_AT_START.test(value)) return `${NO_SCHEME}${value}`;
  return value;
}

function copyWithTextarea(value: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "true");
  ta.setAttribute("aria-hidden", "true");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.width = "1px";
  ta.style.height = "1px";
  ta.style.padding = "0";
  ta.style.border = "none";
  ta.style.outline = "none";
  ta.style.opacity = "0.01";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
  return ok;
}

/** Copy readable text on iPhone/iPad Home Screen without turning it into a URL. */
export async function copyPlainText(text: string): Promise<void> {
  const value = plainClipboardText(text);
  if (!value.replace(/^\u2060/, "").trim()) return;
  if (copyWithTextarea(value)) return;
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([value], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(value);
}
