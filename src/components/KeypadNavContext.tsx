"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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
  const [keypadOpen, setKeypadOpen] = useState(false);
  const value = useMemo(() => ({ keypadOpen, setKeypadOpen }), [keypadOpen]);
  return <KeypadNavContext.Provider value={value}>{children}</KeypadNavContext.Provider>;
}
