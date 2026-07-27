import { Dimensions, type ScrollView, type View } from "react-native";

/** Approximate custom keypad height (3 digit rows + action row + padding). */
export const CUSTOM_KEYPAD_HEIGHT = 320;

/**
 * Scroll a ScrollView so `field` sits above the custom keypad.
 * `scrollYRef` should track the current contentOffset.y via onScroll.
 */
export function scrollFieldAboveKeypad(
  scrollRef: { current: ScrollView | null },
  fieldRef: { current: View | null },
  scrollYRef: { current: number },
  keypadHeight = CUSTOM_KEYPAD_HEIGHT,
) {
  const scroll = scrollRef.current;
  const field = fieldRef.current;
  if (!scroll || !field) return;

  requestAnimationFrame(() => {
    field.measureInWindow((_x, y, _w, h) => {
      const winH = Dimensions.get("window").height;
      const limit = winH - keypadHeight - 16;
      const bottom = y + h;
      if (bottom > limit) {
        const delta = bottom - limit + 24;
        scroll.scrollTo({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true,
        });
        return;
      }
      // Keep a little room under the header
      if (y < 72) {
        scroll.scrollTo({
          y: Math.max(0, scrollYRef.current - (72 - y)),
          animated: true,
        });
      }
    });
  });
}
