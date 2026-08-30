/** White-out only the printed 1–8 house-number column, left of Age. */
export function continuationHouseNumberBox(ageX: number, ageY: number, ageH: number) {
  const x = 14;
  const w = Math.max(16, ageX - x - 1.25);
  return {
    x,
    y: ageY + 0.4,
    w,
    h: Math.max(10, ageH - 0.8),
  };
}
