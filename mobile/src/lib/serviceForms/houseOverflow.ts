/** White-out the printed 1–8 digits only — stay inside the # cell, off the grid lines. */
export function continuationHouseNumberBox(ageX: number, ageY: number, ageH: number) {
  const insetX = 2.4;
  const insetY = 2.2;
  const left = 20.5;
  const right = ageX - insetX;
  const x = left;
  const w = Math.max(9, right - x);
  return {
    x,
    y: ageY + insetY,
    w,
    h: Math.max(6.5, ageH - insetY * 2),
  };
}
