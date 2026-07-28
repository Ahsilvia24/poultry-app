import { useEffect, type RefObject } from "react";
import type { ScrollView } from "react-native";

type ScrollTarget = { scrollTo: (options: { y: number; animated?: boolean }) => void };

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

/** Ask the active screen(s) under a tab to snap to y=0. */
export function requestTabScrollTop(tabName: string) {
  const set = listeners.get(tabName);
  if (!set) return;
  // Defer so navigation/pop can finish before scrolling the revealed screen.
  requestAnimationFrame(() => {
    setTimeout(() => {
      for (const fn of set) fn();
    }, 16);
  });
}

export function subscribeTabScrollTop(tabName: string, listener: Listener) {
  let set = listeners.get(tabName);
  if (!set) {
    set = new Set();
    listeners.set(tabName, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(tabName);
  };
}

/** Snap a ScrollView to the top when its tab requests it. */
export function useTabScrollToTop(
  tabName: string,
  ref: RefObject<ScrollTarget | null>,
) {
  useEffect(() => {
    return subscribeTabScrollTop(tabName, () => {
      ref.current?.scrollTo({ y: 0, animated: false });
    });
  }, [tabName, ref]);
}

/** Nested stack depth for a tab route (0 = root screen). */
export function tabStackIndex(tabRoute: { state?: { index?: number; key?: string } } | undefined) {
  const state = tabRoute?.state;
  if (!state) return { index: 0, key: undefined as string | undefined };
  return { index: state.index ?? 0, key: state.key };
}
