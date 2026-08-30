/** White-out the printed 1–8 digits only — stay inside the # cell, off the grid lines. */
export function continuationHouseNumberBox(ageX: number, ageY: number, ageH: number) {
  const insetRight = 3.9;
  const insetBottom = 0.85;
  const insetTop = 2.5;
  const x = 21;
  const w = Math.max(9, ageX - insetRight - x);
  return {
    x,
    y: ageY + insetBottom,
    w,
    h: Math.max(6.5, ageH - insetBottom - insetTop),
  };
}
