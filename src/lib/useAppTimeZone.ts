"use client";

import { useOffline } from "@/components/OfflineProvider";
import { resolveAppTimeZone } from "@/lib/app-time-zones";

/** Settings timezone. Central until they change it. Works offline from the replica. */
export function useAppTimeZone(): string {
  const { snapshot } = useOffline();
  return resolveAppTimeZone(snapshot?.settings?.appTimeZone);
}
