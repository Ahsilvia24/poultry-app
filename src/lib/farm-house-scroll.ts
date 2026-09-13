/**
 * Back-to-house should not pin the card under the top chrome.
 * Leave a sliver of the previous house (Catch / Mortality / Proj. Mort.) visible.
 */
export const FARM_HOUSE_BACK_PEEK_PX = 104;

export function farmHouseBackScrollTop(houseOffsetTop: number, peekPx = FARM_HOUSE_BACK_PEEK_PX) {
  if (!Number.isFinite(houseOffsetTop)) return 0;
  return Math.max(0, houseOffsetTop - peekPx);
}

export function farmHouseBackScrollTopInScroller(
  houseTop: number,
  scrollerTop: number,
  scrollerScrollTop: number,
  peekPx = FARM_HOUSE_BACK_PEEK_PX,
) {
  return farmHouseBackScrollTop(houseTop - scrollerTop + scrollerScrollTop, peekPx);
}
