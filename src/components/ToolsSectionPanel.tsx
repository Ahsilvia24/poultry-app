"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

export function ToolsSectionPanel({
  hashId,
  title,
  subtitle,
  children,
  footer,
  defaultOpen = true,
  showTop = true,
}: {
  hashId: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Rendered below the section card (e.g. green action links). */
  footer?: React.ReactNode;
  /** When false, section stays hidden until opened via quick link. */
  defaultOpen?: boolean;
  showTop?: boolean;
}) {
  const hash = `#${hashId}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === hash) setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [hash]);

  function snapToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  if (!open) return <div id={hashId} className="scroll-mt-24" />;

  return (
    <div id={hashId} className="scroll-mt-24">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
          </div>
          {showTop ? (
            <button
              type="button"
              onClick={snapToTop}
              className="shrink-0 text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Top
            </button>
          ) : null}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </Card>
      {footer ?? null}
    </div>
  );
}
