/** Keep leftover iOS taps from hitting a tab after the keypad unmounts. */
export const KEYPAD_TAB_GUARD_MS = 1200;

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
  return Boolean(document.querySelector("[data-app-nav]")?.contains(target));
}

function eat(event: Event) {
  if (!isKeypadGuardActive()) return;
  if (!isTabChrome(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
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
  unlisten();
}
