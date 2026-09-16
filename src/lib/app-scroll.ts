/** Shared dashboard scroller — replica pages reuse it, so it keeps the last offset. */
export function resetAppScroll() {
  if (typeof document === "undefined") return;
  const scroller = document.querySelector("[data-app-scroll]");
  if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
  window.scrollTo(0, 0);
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
