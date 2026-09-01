"use client";

import { useEffect, useRef, useState } from "react";

const ROW_H = 36;

export function FarmOrderStepper({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ key: string; label: string }>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const [value, setValue] = useState(defaultValue);
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const last = Math.max(0, options.length - 1);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: index * ROW_H, behavior: "auto" });
  }, [index]);

  function onScrollSettled() {
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const node = scrollerRef.current;
      if (!node) return;
      const next = Math.min(last, Math.max(0, Math.round(node.scrollTop / ROW_H)));
      const option = options[next];
      if (option && option.key !== value) setValue(option.key);
      node.scrollTo({ top: next * ROW_H, behavior: "smooth" });
    }, 80);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <input type="hidden" name={name} value={value} />
      <div
        ref={scrollerRef}
        role="listbox"
        aria-label="Order farms by"
        tabIndex={0}
        onScroll={onScrollSettled}
        className="h-9 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {options.map((option) => (
          <div
            key={option.key}
            role="option"
            aria-selected={option.key === value}
            className="flex h-9 items-center text-base font-semibold text-stone-900"
            style={{ scrollSnapAlign: "start" }}
          >
            {option.label}
          </div>
        ))}
      </div>
      <div className="ml-1 flex flex-col" aria-hidden="true">
        <span className={`flex h-4 items-center justify-center ${index > 0 ? "text-stone-900" : "text-stone-300"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path
              d="M6 15l6-6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={`flex h-4 items-center justify-center ${index < last ? "text-stone-900" : "text-stone-300"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
