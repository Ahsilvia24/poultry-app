import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** How many farm rows stay visible before the list scrolls inside the tile. */
export const VISIBLE_FARM_ROWS = 8;

/**
 * Caps a dashboard farm list to ~8 rows. Extra items scroll inside the tile
 * (trackpad two-finger / mouse wheel on web; touch drag on mobile browsers).
 */
export function ScrollableFarmList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Row ≈ 1.25rem (text-sm / checkbox), gap ≈ 0.375rem (space-y-1.5)
        "max-h-[calc(1.25rem*8+0.375rem*7)] overflow-y-auto overscroll-contain",
        "[scrollbar-gutter:stable]",
        className,
      )}
    >
      {children}
    </div>
  );
}
