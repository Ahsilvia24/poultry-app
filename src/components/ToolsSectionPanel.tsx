"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui";

export function ToolsSectionPanel({
  hashId,
  title,
  subtitle,
  children,
  footer,
}: {
  hashId: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Rendered below the section card (e.g. green action links). */
  footer?: React.ReactNode;
  /** @deprecated Sections stay open; kept for call-site compatibility. */
  defaultOpen?: boolean;
}) {
  const hash = `#${hashId}`;

  useEffect(() => {
    // Ensure hash targets land on this section if navigated with a hash.
    if (window.location.hash === hash) {
      document.getElementById(hashId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash, hashId]);

  function goToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (window.location.hash === hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  return (
    <div id={hashId} className="scroll-mt-24">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={goToTop}
            className="shrink-0 text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Top
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </Card>
      {footer ?? null}
    </div>
  );
}
