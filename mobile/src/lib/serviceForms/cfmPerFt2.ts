/** House CFM ÷ sq ft, trailing zeros dropped (0.450 → 0.45). */
export function cfmPerFt2FromHouse(
  cfm: number | null | undefined,
  sqft: number | null | undefined,
): string {
  if (cfm == null || sqft == null || !Number.isFinite(cfm) || !Number.isFinite(sqft) || sqft <= 0) {
    return "";
  }
  return String(Number((cfm / sqft).toFixed(4)));
}
