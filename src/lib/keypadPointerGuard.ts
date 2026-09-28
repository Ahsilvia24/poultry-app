/** Keep leftover iOS taps from hitting a tab after the keypad unmounts. */
export const KEYPAD_TAB_GUARD_MS = 1200;
export const KEYPAD_SHIELD_ID = "keypad-pointer-shield";

const EAT_TYPES = [
  "click",
  "pointerdown",
  "pointerup",
  "touchstart",
  "touchend",
  "mousedown",
  "mouseup",
] as const;

let armedUntil = 0;
let listening = false;
let clearTimer: number | null = null;

export function isKeypadGuardActive() {
  return Date.now() < armedUntil;
}

function isTabChrome(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const shield = document.getElementById(KEYPAD_SHIELD_ID);
  if (shield?.contains(target)) return true;
  return Boolean(document.querySelector("[data-app-nav]")?.contains(target));
}

function eat(event: Event) {
  if (!isKeypadGuardActive()) return;
  if (!isTabChrome(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function mountShield() {
  if (typeof document === "undefined") return;
  let shield = document.getElementById(KEYPAD_SHIELD_ID);
  if (!shield) {
    shield = document.createElement("div");
    shield.id = KEYPAD_SHIELD_ID;
    shield.setAttribute("aria-hidden", "true");
    // Cover only the tab bar so leftover iOS taps cannot change tabs.
    // A full-screen shield ate mortality / temperature taps.
    shield.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;height:calc(4.75rem + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px)));z-index:2147483647;touch-action:none;pointer-events:auto;";
    document.body.appendChild(shield);
  }
}

function unmountShield() {
  if (typeof document === "undefined") return;
  document.getElementById(KEYPAD_SHIELD_ID)?.remove();
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  for (const type of EAT_TYPES) {
    window.addEventListener(type, eat, { capture: true, passive: false });
  }
}

function unlisten() {
  if (!listening || typeof window === "undefined") return;
  listening = false;
  for (const type of EAT_TYPES) {
    window.removeEventListener(type, eat, { capture: true });
  }
}

/** Call from the same tap that closes the keypad — do not wait for React paint. */
export function armKeypadPointerGuard() {
  if (typeof window === "undefined") return;
  armedUntil = Date.now() + KEYPAD_TAB_GUARD_MS;
  listen();
  mountShield();
  if (clearTimer != null) window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => {
    disarmKeypadPointerGuard();
  }, KEYPAD_TAB_GUARD_MS);
}

export function disarmKeypadPointerGuard() {
  armedUntil = 0;
  if (clearTimer != null && typeof window !== "undefined") {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  unmountShield();
  unlisten();
}
