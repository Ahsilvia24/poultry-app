/** Locked home-indicator inset — never the iOS keyboard height. */
export const APP_SAFE_BOTTOM_VAR = "--app-safe-bottom";
/** Nudge fixed bottom chrome back to the layout viewport. */
export const APP_BOTTOM_SHIFT_VAR = "--app-bottom-shift";

const KEYBOARD_LIFT_PX = 80;

function visualLift() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function measureSafeBottom() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).paddingBottom;
  probe.remove();
  return value || "0px";
}

/**
 * Keep the tab bar on the physical bottom of the phone.
 * iOS otherwise lifts `position:fixed;bottom:0` with the visual viewport
 * (software keyboard / rubber-band), and `env(safe-area-inset-bottom)`
 * can swell to the keyboard height so the white bar fills the mid-screen.
 */
export function syncPhoneBottomChrome() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const lift = visualLift();
  root.style.setProperty(APP_BOTTOM_SHIFT_VAR, `${lift}px`);
  if (lift > KEYBOARD_LIFT_PX) return;
  root.style.setProperty(APP_SAFE_BOTTOM_VAR, measureSafeBottom());
}
