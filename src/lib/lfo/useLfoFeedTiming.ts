"use client";

import { useOffline } from "@/components/OfflineProvider";
import { lfoTimingFromSettings, type LfoFeedTiming } from "@/lib/lfo/calculate";

export function useLfoFeedTiming(): LfoFeedTiming {
  const { snapshot } = useOffline();
  return lfoTimingFromSettings(snapshot?.settings);
}
