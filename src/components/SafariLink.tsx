"use client";

import type { MouseEvent, ReactNode } from "react";

function isHomeScreenApp() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

/** Home Screen iOS swallows same-tab taps to Support / Privacy. Open them like Safari. */
export function SafariLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const url = new URL(href, window.location.origin).href;
    if (!isHomeScreenApp()) return;
    event.preventDefault();
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
