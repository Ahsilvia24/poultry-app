"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard copy-to-clipboard control (web).
 * Always use this for new copy actions — same overlapping-pages "clipboard"
 * glyph as mobile `ClipboardIconButton` (Ionicons `copy-outline`).
 */
function ClipboardGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ClipboardIconButton({
  getText,
  accessibilityLabel = "Copy",
  className,
  iconClassName = "h-4 w-4",
  copiedDurationMs = 1500,
}: {
  getText: () => string | Promise<string>;
  accessibilityLabel?: string;
  className?: string;
  iconClassName?: string;
  copiedDurationMs?: number;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), copiedDurationMs);
    return () => window.clearTimeout(t);
  }, [copied, copiedDurationMs]);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : accessibilityLabel}
      title={copied ? "Copied" : accessibilityLabel}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900",
        copied && "text-emerald-700",
        className,
      )}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const text = await getText();
          if (!text.trim()) return;
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // ignore
        }
      }}
    >
      {copied ? (
        <CheckGlyph className={cn(iconClassName, "text-emerald-700")} />
      ) : (
        <ClipboardGlyph className={iconClassName} />
      )}
    </button>
  );
}
