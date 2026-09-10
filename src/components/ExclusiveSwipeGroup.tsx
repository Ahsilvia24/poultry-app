"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const ExclusiveSwipeContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

/** Sibling swipe rows: only one stays open so taps still work. */
export function ExclusiveSwipeGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    function close() {
      setOpenId(null);
    }
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, []);

  return (
    <ExclusiveSwipeContext.Provider value={{ openId, setOpenId }}>
      {children}
    </ExclusiveSwipeContext.Provider>
  );
}

export function useExclusiveSwipeRow(id: string) {
  const ctx = useContext(ExclusiveSwipeContext);
  const isOpenOwner = !ctx || ctx.openId === id;

  const requestOpen = useCallback(() => {
    ctx?.setOpenId(id);
  }, [ctx, id]);

  const requestClose = useCallback(() => {
    if (ctx?.openId === id) ctx.setOpenId(null);
  }, [ctx, id]);

  return { isOpenOwner, requestOpen, requestClose };
}
