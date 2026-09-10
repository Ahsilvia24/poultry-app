import { useCallback, useRef } from "react";
import type { Swipeable } from "react-native-gesture-handler";

/** Only one swipe-to-delete row stays open; others close so taps work again. */
export function useExclusiveSwipeables() {
  const refs = useRef(new Map<string, Swipeable>());

  const setRef = useCallback((id: string) => {
    return (node: Swipeable | null) => {
      if (node) refs.current.set(id, node);
      else refs.current.delete(id);
    };
  }, []);

  const closeOthers = useCallback((exceptId: string) => {
    refs.current.forEach((node, id) => {
      if (id !== exceptId) node.close();
    });
  }, []);

  const closeAll = useCallback(() => {
    refs.current.forEach((node) => node.close());
  }, []);

  return { setRef, closeOthers, closeAll };
}
