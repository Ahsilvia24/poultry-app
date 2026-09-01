"use client";

import { useEffect, useRef, useState } from "react";

export function FarmOrderStepper({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ key: string; label: string }>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const selected = options.find((option) => option.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Order farms by"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-9 w-full items-center text-left"
      >
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-stone-900">
          {selected?.label}
        </span>
        <span className="ml-1 flex flex-col" aria-hidden="true">
          <span className="flex h-4 items-center justify-center text-stone-900">
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
          <span className="flex h-4 items-center justify-center text-stone-900">
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
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-0.5 max-h-36 overflow-y-auto overscroll-contain rounded-[10px] border border-stone-200 bg-white py-0.5 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((option) => {
            const active = option.key === value;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setValue(option.key);
                    setOpen(false);
                  }}
                  className={`flex min-h-9 w-full items-center px-2.5 text-left text-base ${
                    active ? "bg-emerald-50/70 font-extrabold" : "font-semibold"
                  } text-stone-900`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
