/** Same peek as web `FARM_HOUSE_BACK_PEEK_PX` — previous house stats stay visible. */
export const FARM_HOUSE_BACK_PEEK_PX = 104;

export function farmHouseBackScrollTop(houseOffsetTop: number, peekPx = FARM_HOUSE_BACK_PEEK_PX) {
  if (!Number.isFinite(houseOffsetTop)) return 0;
  return Math.max(0, houseOffsetTop - peekPx);
}
