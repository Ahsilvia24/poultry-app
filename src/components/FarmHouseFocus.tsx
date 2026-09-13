"use client";

import { useLayoutEffect } from "react";
import {
  FARM_HOUSE_BACK_PEEK_PX,
  farmHouseBackScrollTopInScroller,
} from "@/lib/farm-house-scroll";

function scrollHouseIntoContext(el: HTMLElement) {
  const scroller = el.closest("[data-app-scroll]");
  if (scroller instanceof HTMLElement) {
    const nextTop = farmHouseBackScrollTopInScroller(
      el.getBoundingClientRect().top,
      scroller.getBoundingClientRect().top,
      scroller.scrollTop,
      FARM_HOUSE_BACK_PEEK_PX,
    );
    scroller.scrollTo({ top: nextTop, behavior: "auto" });
    return;
  }
  const top = farmHouseBackScrollTopInScroller(
    el.getBoundingClientRect().top,
    0,
    window.scrollY,
    FARM_HOUSE_BACK_PEEK_PX,
  );
  window.scrollTo({ top, behavior: "auto" });
}

/** One-shot scroll after Mortality "Back to House". */
export function FarmHouseFocus({ houseId }: { houseId: string | null | undefined }) {
  useLayoutEffect(() => {
    if (!houseId) return;
    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      const el = document.getElementById(`house-${houseId}`);
      if (el) {
        scrollHouseIntoContext(el);
        return;
      }
      if (attempts++ < 12) {
        timer = window.setTimeout(tryScroll, 40);
      }
    };
    tryScroll();
    return () => window.clearTimeout(timer);
  }, [houseId]);
  return null;
}
