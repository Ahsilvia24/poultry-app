"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Scroll to a house tile from Mortality "Back to House" (`?focusHouseFlockId=`). */
export function FocusHouseOnMount({
  houseIdByFlockId,
}: {
  houseIdByFlockId: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const focusHouseFlockId = searchParams.get("focusHouseFlockId");

  useEffect(() => {
    if (!focusHouseFlockId) return;
    const houseId = houseIdByFlockId[focusHouseFlockId];
    if (!houseId) return;

    const el = document.getElementById(`house-${houseId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Consume the one-shot param so refresh / later visits don't re-snap.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("focusHouseFlockId");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [focusHouseFlockId, houseIdByFlockId, pathname, router, searchParams]);

  return null;
}
