/** Scroll Y that pins Comments to the visible top, not above the Safari keyboard. */
export function commentsScrollYForFocus(sectionY: number, visualOffsetTop = 0, pad = 8) {
  return Math.max(0, sectionY - Math.max(0, visualOffsetTop) - pad);
}

export function visualViewportOffsetTop() {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.offsetTop ?? 0;
}
