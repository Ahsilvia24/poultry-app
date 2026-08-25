/**
 * Scroll delta for mortality week jumps (Enter / Backspace / landing).
 * Positive = scroll down (increase contentOffset.y). Window coordinates.
 *
 * Goals:
 * 1. The focused typing box stays fully inside the visible scroll viewport
 *    (never under the keypad).
 * 2. When the whole week fits, also bring the week's last day into view
 *    just above the keypad.
 */
export type WeekJumpRects = {
  visibleTop: number;
  visibleBottom: number;
  focusedTop: number;
  focusedBottom: number;
  lastBottom: number;
};

export function weekJumpScrollDelta({
  visibleTop,
  visibleBottom,
  focusedTop,
  focusedBottom,
  lastBottom,
}: WeekJumpRects): number {
  if (visibleBottom <= visibleTop) return 0;

  let delta = 0;
  if (focusedBottom > visibleBottom) {
    delta = focusedBottom - visibleBottom;
  } else if (focusedTop < visibleTop) {
    delta = focusedTop - visibleTop;
  }

  const lastAfter = lastBottom - delta;
  if (lastAfter > visibleBottom) {
    const extra = lastAfter - visibleBottom;
    const focusedTopAfter = focusedTop - delta - extra;
    if (focusedTopAfter >= visibleTop) {
      delta += extra;
    }
  }

  return delta;
}
