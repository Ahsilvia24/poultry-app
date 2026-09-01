/** How far left a row must travel before release deletes it. */
export const SWIPE_DELETE_COMMIT_PX = 80;

/** @deprecated Same as SWIPE_DELETE_COMMIT_PX — kept for existing imports. */
export const LFO_SWIPE_DELETE_COMMIT_PX = SWIPE_DELETE_COMMIT_PX;

/** Card / swipe-row corner radius — keep clip and tile in sync so nothing squares off. */
export const SWIPE_ROW_RADIUS = 14;

export function shouldCommitSwipeDelete(
  dx: number,
  commitPx = SWIPE_DELETE_COMMIT_PX,
): boolean {
  return dx <= -Math.abs(commitPx);
}
