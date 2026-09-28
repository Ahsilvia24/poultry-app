"use client";

import { useEffect } from "react";
import { syncPhoneBottomChrome } from "@/lib/pinBottomChrome";

/** Pin the tab bar and freeze the home-indicator inset on iOS Home Screen. */
export function LockPhoneChrome() {
  useEffect(() => {
    const sync = () => syncPhoneBottomChrome();
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
  return null;
}
