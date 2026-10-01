/** House CFM ÷ sq ft, rounded to 2 decimals (1.3468 → 1.35). Trailing zeros dropped. */
export function cfmPerFt2FromHouse(
  cfm: number | null | undefined,
  sqft: number | null | undefined,
): string {
  if (cfm == null || sqft == null || !Number.isFinite(cfm) || !Number.isFinite(sqft) || sqft <= 0) {
    return "";
  }
  return String(Number((cfm / sqft).toFixed(2)));
}
