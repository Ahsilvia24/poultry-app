"use client";

import { useEffect, useState } from "react";

function CopyGlyph({ className }: { className?: string }) {
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

function ShareGlyph({ className }: { className?: string }) {
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
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900 disabled:opacity-40";

export function CopyIconButton({
  onClick,
  disabled,
  copied,
  label = "Copy",
}: {
  onClick: () => void;
  disabled?: boolean;
  copied?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : "Copy"}
      disabled={disabled}
      onClick={onClick}
      className={iconBtn}
    >
      {copied ? (
        <CheckGlyph className="h-4 w-4 text-emerald-700" />
      ) : (
        <CopyGlyph className="h-4 w-4" />
      )}
    </button>
  );
}

export function ShareIconButton({
  onClick,
  disabled,
  label = "Share PDF",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={iconBtn}
    >
      <ShareGlyph className="h-4 w-4" />
    </button>
  );
}

/** Share sits top-right; Copy is immediately to its left. */
export function CopyShareRow({
  onCopy,
  onShare,
  copyDisabled,
  shareDisabled,
  copyLabel,
  shareLabel,
}: {
  onCopy: () => void;
  onShare: () => void;
  copyDisabled?: boolean;
  shareDisabled?: boolean;
  copyLabel?: string;
  shareLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex items-center">
      <CopyIconButton
        label={copyLabel}
        disabled={copyDisabled}
        copied={copied}
        onClick={() => {
          onCopy();
          if (!copyDisabled) setCopied(true);
        }}
      />
      <ShareIconButton label={shareLabel} disabled={shareDisabled} onClick={onShare} />
    </div>
  );
}
