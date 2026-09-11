"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useOffline } from "@/components/OfflineProvider";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { isReplicaHref, snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";

export function ReplicaLink({
  href,
  onClick,
  children,
  ...props
}: LinkProps & {
    className?: string;
    children?: ReactNode;
    "aria-label"?: string;
    prefetch?: boolean;
    onPointerEnter?: (event: MouseEvent<HTMLAnchorElement>) => void;
    onTouchStart?: (event: MouseEvent<HTMLAnchorElement> | unknown) => void;
  }) {
  const { snapshot } = useOffline();
  const nav = useOfflineNav();
  const target = typeof href === "string" ? href : href.pathname ?? "/";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!nav || !snapshotHasFarmGraph(snapshot) || !isReplicaHref(target)) return;
    event.preventDefault();
    nav.navigate(target);
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
