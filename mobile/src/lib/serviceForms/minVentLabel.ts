/** Inset from the printed slash so 1–3 digit values sit in each half-box. */
export const MIN_VENT_SLASH_GAP = 10;

export function minVentSideBoxes(widget: { x: number; w: number }, slashGap = MIN_VENT_SLASH_GAP) {
  const mid = widget.x + widget.w / 2;
  return {
    mid,
    left: { x: widget.x, w: Math.max(0, mid - slashGap - widget.x) },
    right: { x: mid + slashGap, w: Math.max(0, widget.x + widget.w - (mid + slashGap)) },
  };
}

/** Center a stamp in one half of a min-vent box. */
export function minVentCenteredX(box: { x: number; w: number }, textWidth: number) {
  if (textWidth >= box.w) return box.x;
  return box.x + (box.w - textWidth) / 2;
}

export function recommendedWeekLabel(week: number | "" | null | undefined) {
  if (week === "" || week == null || week === 0) return "Blank";
  return `Week ${week}`;
}

export const WEEK_OPTIONS = [
  { value: "", label: "Blank" },
  ...Array.from({ length: 8 }, (_, i) => ({
    value: String(i + 1),
    label: `Week ${i + 1}`,
  })),
];
