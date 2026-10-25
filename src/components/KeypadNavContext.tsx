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
} from "@/lib/keypadPointerGuard";

export { KEYPAD_TAB_GUARD_MS, isKeypadGuardActive } from "@/lib/keypadPointerGuard";

export type KeypadOpenOpts = { guard?: boolean };

type KeypadNavContextValue = {
  keypadOpen: boolean;
  setKeypadOpen: (open: boolean, opts?: KeypadOpenOpts) => void;
};

const KeypadNavContext = createContext<KeypadNavContextValue>({
  keypadOpen: false,
  setKeypadOpen: () => {},
});

export function useKeypadNav() {
  return useContext(KeypadNavContext);
}

function setTabBarHidden(hidden: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.toggleAttribute("data-keypad-open", hidden);
}

export function KeypadNavProvider({ children }: { children: ReactNode }) {
  const [keypadOpen, setKeypadOpenState] = useState(false);
  const openRef = useRef(false);

  const setKeypadOpen = useCallback((open: boolean, opts?: KeypadOpenOpts) => {
    if (open) {
      disarmKeypadPointerGuard();
      openRef.current = true;
      setKeypadOpenState(true);
      // Hide tabs before paint so the keypad does not sit on top of them.
      setTabBarHidden(true);
      return;
    }
    // House cards / tools call setKeypadOpen(false) on mount and unmount.
    // Only arm the tap guard after a keypad that was actually open — otherwise
    // every page change eats the next tab tap.
    if (!openRef.current) return;
    openRef.current = false;
    setKeypadOpenState(false);
    // Show the tab bar immediately. Leaving it hidden until a timer fired
    // made Back to House land on the farm with no bottom tabs.
    setTabBarHidden(false);
    // Unmount / route change must not eat the next mortality or temp tap.
    if (opts?.guard === false) return;
    armKeypadPointerGuard();
  }, []);

  useEffect(() => {
    return () => {
      disarmKeypadPointerGuard();
    };
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-keypad-open", keypadOpen);
    return () => document.documentElement.removeAttribute("data-keypad-open");
  }, [keypadOpen]);
  const value = useMemo(
    () => ({ keypadOpen, setKeypadOpen }),
    [keypadOpen, setKeypadOpen],
  );
  return <KeypadNavContext.Provider value={value}>{children}</KeypadNavContext.Provider>;
}
