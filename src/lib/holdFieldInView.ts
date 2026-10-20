/** Bottom chrome (tab bar) when the software keyboard is closed. */
export const FIELD_CHROME_BOTTOM_PAD = 112;
/** Gap kept above the software keyboard. */
export const FIELD_KEYBOARD_BOTTOM_PAD = 16;
export const FIELD_TOP_PAD = 12;
/** Same threshold as the pinned tab bar: a larger lift is the keyboard. */
export const FIELD_KEYBOARD_LIFT_PX = 80;

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "image",
  "range",
  "color",
]);

export function isTextEntry(
  tag: string,
  type: string | null,
  readOnly: boolean,
  disabled: boolean,
): boolean {
  if (readOnly || disabled) return false;
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  return !SKIP_INPUT_TYPES.has((type || "text").toLowerCase());
}

export function fieldBand(metrics: {
  innerHeight: number;
  visualHeight: number | null;
  visualOffsetTop: number;
}): { viewHeight: number; topPad: number; bottomPad: number } {
  const visualHeight =
    metrics.visualHeight == null || metrics.visualHeight <= 0
      ? metrics.innerHeight
      : metrics.visualHeight;
  const lift = Math.max(
    0,
    metrics.innerHeight - visualHeight - Math.max(0, metrics.visualOffsetTop),
  );
  return {
    viewHeight: visualHeight,
    topPad: FIELD_TOP_PAD,
    bottomPad: lift > FIELD_KEYBOARD_LIFT_PX ? FIELD_KEYBOARD_BOTTOM_PAD : FIELD_CHROME_BOTTOM_PAD,
  };
}

/**
 * Pixels to add to scrollTop so the field sits in the visible band.
 * Positive moves the field up. A field taller than the band keeps its top
 * (the caret) on screen and does not chase the bottom edge.
 */
export function fieldScrollDelta(input: {
  rectTop: number;
  rectBottom: number;
  viewHeight: number;
  topPad: number;
  bottomPad: number;
}): number {
  const visibleBottom = input.viewHeight - input.bottomPad;
  const height = input.rectBottom - input.rectTop;
  const tall = height > visibleBottom - input.topPad;
  if (input.rectTop < input.topPad) return input.rectTop - input.topPad;
  if (tall) {
    if (input.rectTop > visibleBottom) return input.rectTop - input.topPad;
    return 0;
  }
  if (input.rectBottom > visibleBottom) return input.rectBottom - visibleBottom;
  return 0;
}

/**
 * Undo a focus jump back to where the field was tapped when that spot is
 * still on screen. Otherwise move only enough to clear the keyboard.
 */
export function focusScrollDelta(input: {
  rectTop: number;
  rectBottom: number;
  anchorTop: number | null;
  anchorBottom: number | null;
  viewHeight: number;
  topPad: number;
  bottomPad: number;
}): number {
  const band = {
    viewHeight: input.viewHeight,
    topPad: input.topPad,
    bottomPad: input.bottomPad,
  };
  const current = fieldScrollDelta({
    rectTop: input.rectTop,
    rectBottom: input.rectBottom,
    ...band,
  });
  if (input.anchorTop == null || input.anchorBottom == null) return current;
  const anchorInBand =
    fieldScrollDelta({
      rectTop: input.anchorTop,
      rectBottom: input.anchorBottom,
      ...band,
    }) === 0;
  if (!anchorInBand) return current;
  const shifted = input.rectTop - input.anchorTop;
  if (Math.abs(shifted) < 2) return current;
  return shifted;
}

const WATCH_MS = 1100;
const CORRECT_AT_MS = [0, 80, 200, 400, 700, 1000];

type Session = {
  el: HTMLElement;
  anchorTop: number;
  anchorBottom: number;
  timers: number[];
  stop: () => void;
};

let session: Session | null = null;
let pendingAnchor: { el: HTMLElement; top: number; bottom: number } | null = null;
let correcting = false;
let passes = 0;

function entryTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const tag = target.tagName.toLowerCase();
  const type = target instanceof HTMLInputElement ? target.type : null;
  const readOnly =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.readOnly
      : false;
  const disabled = "disabled" in target && Boolean((target as HTMLInputElement).disabled);
  if (!isTextEntry(tag, type, readOnly, disabled)) return null;
  if (!target.closest("[data-checklist]")) return null;
  return target;
}

function readBand() {
  const vv = window.visualViewport;
  return fieldBand({
    innerHeight: window.innerHeight,
    visualHeight: vv?.height ?? null,
    visualOffsetTop: vv?.offsetTop ?? 0,
  });
}

function applyScroll(delta: number) {
  if (Math.abs(delta) < 1) return;
  const scroller = document.querySelector("[data-app-scroll]");
  if (scroller instanceof HTMLElement) {
    const overflowY = getComputedStyle(scroller).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      scroller.scrollTop += delta;
      return;
    }
  }
  window.scrollBy(0, delta);
}

function correct() {
  if (correcting || !session || passes > 12) return;
  if (document.activeElement !== session.el) return;
  const rect = session.el.getBoundingClientRect();
  const delta = focusScrollDelta({
    rectTop: rect.top,
    rectBottom: rect.bottom,
    anchorTop: session.anchorTop,
    anchorBottom: session.anchorBottom,
    ...readBand(),
  });
  if (Math.abs(delta) < 1) return;
  passes += 1;
  correcting = true;
  applyScroll(delta);
  correcting = false;
}

function disarm() {
  if (!session) return;
  for (const id of session.timers) window.clearTimeout(id);
  session.stop();
  session = null;
}

function schedule() {
  if (!session) return;
  passes = 0;
  for (const id of session.timers) window.clearTimeout(id);
  session.timers = CORRECT_AT_MS.map((ms) => window.setTimeout(correct, ms));
  session.timers.push(window.setTimeout(disarm, WATCH_MS));
}

function arm(el: HTMLElement, anchor: { top: number; bottom: number } | null) {
  if (session?.el === el) {
    schedule();
    correct();
    return;
  }
  disarm();
  const rect = el.getBoundingClientRect();
  const onChange = () => correct();
  const vv = window.visualViewport;
  window.addEventListener("scroll", onChange, true);
  vv?.addEventListener("scroll", onChange);
  vv?.addEventListener("resize", onChange);
  session = {
    el,
    anchorTop: anchor?.top ?? rect.top,
    anchorBottom: anchor?.bottom ?? rect.bottom,
    timers: [],
    stop: () => {
      window.removeEventListener("scroll", onChange, true);
      vv?.removeEventListener("scroll", onChange);
      vv?.removeEventListener("resize", onChange);
    },
  };
  schedule();
  correct();
}

/** Keep the focused text field where it was tapped, above the keyboard. */
export function installHoldFocusedField() {
  const onPointerDown = (event: Event) => {
    const el = entryTarget(event.target);
    if (!el) {
      pendingAnchor = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    pendingAnchor = { el, top: rect.top, bottom: rect.bottom };
  };
  const onFocusIn = (event: FocusEvent) => {
    const el = entryTarget(event.target);
    const anchor =
      el && pendingAnchor?.el === el
        ? { top: pendingAnchor.top, bottom: pendingAnchor.bottom }
        : null;
    pendingAnchor = null;
    if (!el) return;
    arm(el, anchor);
  };
  const onInput = (event: Event) => {
    const el = entryTarget(event.target);
    if (!el || document.activeElement !== el) return;
    if (session?.el === el) {
      schedule();
      correct();
      return;
    }
    arm(el, null);
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("input", onInput);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("input", onInput);
    pendingAnchor = null;
    disarm();
  };
}
