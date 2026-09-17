/** Shared dashboard scroller — replica pages reuse it, so it keeps the last offset. */
export function getAppScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-app-scroll]");
  if (!(el instanceof HTMLElement)) return null;
  const overflowY = getComputedStyle(el).overflowY;
  if (overflowY === "auto" || overflowY === "scroll") return el;
  return null;
}

export function resetAppScroll() {
  const scroller = getAppScroller();
  if (scroller) scroller.scrollTop = 0;
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}

export function appScrollY() {
  const scroller = getAppScroller();
  return scroller ? scroller.scrollTop : typeof window === "undefined" ? 0 : window.scrollY;
}

export function appScrollTo(top: number) {
  const scroller = getAppScroller();
  if (scroller) {
    scroller.scrollTo({ top, left: 0, behavior: "auto" });
    return;
  }
  if (typeof window !== "undefined") window.scrollTo({ top, left: 0, behavior: "auto" });
}

export function hrefHasHouseFocus(href: string): boolean {
  try {
    const params = new URL(href, "https://poultrytech.local").searchParams;
    return Boolean(
      params.get("focusHouseId")?.trim() || params.get("focusHouseFlockId")?.trim(),
    );
  } catch {
    return false;
  }
}
