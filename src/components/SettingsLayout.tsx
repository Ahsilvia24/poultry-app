"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Settings page layout — label on the left, grey edit box on the right.
 * Say “settings layout” when you want this on another tile.
 */
export const settingsLabelClass =
  "min-w-0 flex-1 text-[15px] font-semibold leading-none text-stone-800";
export const settingsValueTextClass =
  "w-full border-0 bg-transparent p-0 text-right text-[15px] font-semibold leading-none text-stone-900 outline-none focus:ring-0";
export const settingsValueChipClass =
  "flex h-9 items-center justify-end rounded-lg bg-stone-200 px-2.5";

export function placeCaretAtEnd(el: HTMLInputElement) {
  const move = () => {
    const n = el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* iOS may ignore selection on some input types */
    }
  };
  move();
  requestAnimationFrame(move);
  window.setTimeout(move, 0);
  window.setTimeout(move, 50);
}

export function SettingsFieldRow({
  label,
  htmlFor,
  children,
  labelClassName,
}: {
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
  labelClassName?: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={htmlFor} className={cn(settingsLabelClass, labelClassName)}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function SettingsValueChip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(settingsValueChipClass, className)}>{children}</div>;
}

/** Grey chip plus a control that sits immediately to its left (Propagate). */
export function SettingsTrailing({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-1.5">{children}</div>;
}

export function SettingsChipInput({
  id,
  name,
  value,
  defaultValue,
  required,
  autoComplete,
  autoCapitalize,
  inputMode = "text",
  placeholder,
  onChange,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string | number;
  required?: boolean;
  autoComplete?: string;
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  inputMode?: "text" | "numeric" | "decimal";
  placeholder?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete ?? "off"}
      autoCapitalize={autoCapitalize}
      {...(value !== undefined ? { value } : { defaultValue })}
      required={required}
      placeholder={placeholder}
      onChange={onChange}
      onFocus={(event) => placeCaretAtEnd(event.currentTarget)}
      className={settingsValueTextClass}
    />
  );
}

export function focusNextSettingsField(current: HTMLElement) {
  const root = current.closest("form");
  if (!root) return;
  const fields = [...root.querySelectorAll<HTMLElement>("input, select, textarea")].filter((el) => {
    if (el instanceof HTMLInputElement) {
      return !el.disabled && el.type !== "hidden" && el.type !== "submit" && el.type !== "button";
    }
    if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      return !el.disabled;
    }
    return false;
  });
  const index = fields.indexOf(current);
  const next = index >= 0 ? fields[index + 1] : undefined;
  next?.focus();
}

export function handleSettingsLayoutEnter(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type === "submit" || target.type === "button") return;
  event.preventDefault();
  focusNextSettingsField(target);
}
