"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  armKeypadPointerGuard,
  disarmKeypadPointerGuard,
  KEYPAD_TAB_GUARD_MS,
} from "@/lib/keypadPointerGuard";

export { KEYPAD_TAB_GUARD_MS, isKeypadGuardActive } from "@/lib/keypadPointerGuard";

type KeypadNavContextValue = {
  keypadOpen: boolean;
  setKeypadOpen: (open: boolean) => void;
};

const KeypadNavContext = createContext<KeypadNavContextValue>({
  keypadOpen: false,
  setKeypadOpen: () => {},
});

export function useKeypadNav() {
  return useContext(KeypadNavContext);
}

export function KeypadNavProvider({ children }: { children: ReactNode }) {
  const [keypadOpen, setKeypadOpenState] = useState(false);
  const [tabsBlocked, setTabsBlocked] = useState(false);
  const blockTimer = useRef<number | null>(null);

  const setKeypadOpen = useCallback((open: boolean) => {
    if (open) {
      disarmKeypadPointerGuard();
      if (blockTimer.current != null) {
        window.clearTimeout(blockTimer.current);
        blockTimer.current = null;
      }
      setTabsBlocked(false);
      setKeypadOpenState(true);
      return;
    }
    armKeypadPointerGuard();
    setKeypadOpenState(false);
    setTabsBlocked(true);
    if (blockTimer.current != null) window.clearTimeout(blockTimer.current);
    blockTimer.current = window.setTimeout(() => {
      setTabsBlocked(false);
      blockTimer.current = null;
    }, KEYPAD_TAB_GUARD_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (blockTimer.current != null) window.clearTimeout(blockTimer.current);
      disarmKeypadPointerGuard();
    };
  }, []);

  const hideChrome = keypadOpen || tabsBlocked;
  const value = useMemo(
    () => ({ keypadOpen: hideChrome, setKeypadOpen }),
    [hideChrome, setKeypadOpen],
  );
  return <KeypadNavContext.Provider value={value}>{children}</KeypadNavContext.Provider>;
}
