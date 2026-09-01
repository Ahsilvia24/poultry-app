/** How far left a row must travel before release deletes it. */
export const SWIPE_DELETE_COMMIT_PX = 100;

/** LFO tiles: shorter swipe than the old 160px travel. */
export const LFO_SWIPE_DELETE_COMMIT_PX = 80;

/** Cap how far the row can follow the finger (shows red behind). */
export const SWIPE_DELETE_MAX_PX = 140;

export const LFO_SWIPE_DELETE_MAX_PX = 110;

export function shouldCommitSwipeDelete(
  dx: number,
  commitPx = SWIPE_DELETE_COMMIT_PX,
): boolean {
  return dx <= -Math.abs(commitPx);
}
