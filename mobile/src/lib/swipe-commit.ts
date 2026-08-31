/** How far left a row must travel before release deletes it. */
export const SWIPE_DELETE_COMMIT_PX = 100;

/** Cap how far the row can follow the finger (shows red behind). */
export const SWIPE_DELETE_MAX_PX = 140;

export function shouldCommitSwipeDelete(
  dx: number,
  commitPx = SWIPE_DELETE_COMMIT_PX,
): boolean {
  return dx <= -Math.abs(commitPx);
}
