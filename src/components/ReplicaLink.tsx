"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOffline } from "@/components/OfflineProvider";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { isReplicaHref, snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { isKeypadGuardActive } from "@/lib/keypadPointerGuard";

/** Navigate like ReplicaLink without rendering an `<a href>`, so iOS won't show a link preview. */
export function useReplicaNavigate() {
  const router = useRouter();
  const { snapshot } = useOffline();
  const nav = useOfflineNav();

  return (href: string) => {
    if (nav && snapshotHasFarmGraph(snapshot) && isReplicaHref(href)) {
      nav.navigate(href);
      return;
    }
    router.push(href);
  };
}

export function ReplicaLink({
  href,
  onClick,
  onTouchStart,
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
    if (isKeypadGuardActive()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!nav || !snapshotHasFarmGraph(snapshot) || !isReplicaHref(target)) return;
    event.preventDefault();
    nav.navigate(target);
  }

  function handleTouchStart(event: MouseEvent<HTMLAnchorElement> | unknown) {
    if (isKeypadGuardActive()) {
      const ev = event as { preventDefault?: () => void };
      ev.preventDefault?.();
      return;
    }
    onTouchStart?.(event);
  }

  return (
    <Link href={href} onClick={handleClick} onTouchStart={handleTouchStart} {...props}>
      {children}
    </Link>
  );
}
