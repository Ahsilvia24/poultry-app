/** How far left a row must travel before release deletes it. */
export const SWIPE_DELETE_COMMIT_PX = 100;

/** Longer swipe used on LFO tiles — delete on release, no confirm. */
export const LFO_SWIPE_DELETE_COMMIT_PX = 160;

/** Cap how far the row can follow the finger (shows red behind). */
export const SWIPE_DELETE_MAX_PX = 140;

/** Wider travel for LFO tiles so the swipe is clearly intentional. */
export const LFO_SWIPE_DELETE_MAX_PX = 200;

export function shouldCommitSwipeDelete(
  dx: number,
  commitPx = SWIPE_DELETE_COMMIT_PX,
): boolean {
  return dx <= -Math.abs(commitPx);
}
