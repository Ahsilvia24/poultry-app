/** Shared dashboard scroller — replica pages reuse it, so it keeps the last offset. */
export function resetAppScroll() {
  if (typeof document === "undefined") return;
  const scroller = document.querySelector("[data-app-scroll]");
  if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
  window.scrollTo(0, 0);
}

export function hrefHasHouseFocus(href: string): boolean {
  try {
    const id = new URL(href, "https://poultrytech.local").searchParams.get("focusHouseFlockId");
    return Boolean(id?.trim());
  } catch {
    return false;
  }
}
