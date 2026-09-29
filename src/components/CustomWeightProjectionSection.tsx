"use client";

import { useCallback, useState } from "react";
import { copyPlainText } from "@/lib/copyPlainText";
import { ToolsSectionPanel } from "@/components/ToolsSectionPanel";
import type { WeightFarmPayload } from "@/components/ToolsWeightProjections";
import { WeightProjectionManualTile } from "@/components/WeightProjectionManualTile";

export function CustomWeightProjectionSection({
  farms = [],
}: {
  farms?: WeightFarmPayload[];
} = {}) {
  const [copyText, setCopyText] = useState("");

  const onCopy = useCallback(async () => {
    const text = copyText.trim();
    if (!text) return;
    await copyPlainText(text);
  }, [copyText]);

  return (
    <ToolsSectionPanel
      hashId="weight-projections-manual"
      title="Weight Projection - Feed"
      onCopy={onCopy}
      copyLabel="Copy weight projection - feed"
    >
      <WeightProjectionManualTile farms={farms} onCopyTextChange={setCopyText} />
    </ToolsSectionPanel>
  );
}
