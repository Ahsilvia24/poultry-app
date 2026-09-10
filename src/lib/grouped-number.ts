/** Format a typed numeric string with thousands separators: 23000 → "23,000". */
export function formatGroupedInput(raw: string, decimal = false): string {
  if (!raw) return "";
  const compact = raw.replace(/,/g, "");
  if (!decimal) {
    const digits = compact.replace(/\D/g, "");
    if (digits === "") return "";
    return Number(digits).toLocaleString("en-US");
  }
  const cleaned = compact.replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return cleaned === "." ? "0." : "";
  const firstDot = cleaned.indexOf(".");
  const intRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const frac = firstDot === -1 ? "" : cleaned.slice(firstDot + 1).replace(/\./g, "");
  const intFormatted = (intRaw === "" ? "0" : Number(intRaw)).toLocaleString("en-US");
  if (firstDot === -1) return intFormatted;
  return `${intFormatted}.${frac}`;
}

export function ungroupNumber(raw: string): string {
  return raw.replace(/,/g, "");
}

export function parseGroupedNumber(raw: string): number {
  return Number(ungroupNumber(raw).trim());
}
