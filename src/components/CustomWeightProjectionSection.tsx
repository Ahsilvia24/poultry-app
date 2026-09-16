"use client";

import { useCallback, useState } from "react";
import { ToolsSectionPanel } from "@/components/ToolsSectionPanel";
import { WeightProjectionManualTile } from "@/components/WeightProjectionManualTile";

export function CustomWeightProjectionSection() {
  const [copyText, setCopyText] = useState("");

  const onCopy = useCallback(async () => {
    const text = copyText.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [copyText]);

  return (
    <ToolsSectionPanel
      hashId="weight-projections-manual"
      title="Custom Weight Projection"
      onCopy={onCopy}
      copyLabel="Copy custom weight projection"
    >
      <WeightProjectionManualTile onCopyTextChange={setCopyText} />
    </ToolsSectionPanel>
  );
}
