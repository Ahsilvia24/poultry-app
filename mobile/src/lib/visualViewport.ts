/** Pin a sheet to the visible viewport (Safari scrolls the layout viewport when an input focuses). */
export function visualViewportOverlayBox(
  innerHeight: number,
  viewport: { height: number; offsetTop: number } | null | undefined,
): { top: number; height: number } {
  const height = viewport?.height ?? 0;
  const top = viewport?.offsetTop ?? 0;
  if (height <= 0) return { top: 0, height: Math.max(0, innerHeight) };
  return { top, height };
}
