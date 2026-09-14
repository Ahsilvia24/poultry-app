"use client";

import { FarmGeneratorLogSection } from "@/components/FarmGeneratorLogSection";
import { BackHeader } from "@/components/ui";
import type { GeneratorsPageModel } from "@/lib/offline/selectGenerators";

export function FarmGeneratorsView({ model }: { model: GeneratorsPageModel }) {
  return (
    <div>
      <BackHeader href={`/farms/${model.farmId}`} backLabel="Farm" title="Generator Log" />
      <FarmGeneratorLogSection farmId={model.farmId} logs={model.logs} pageMode />
    </div>
  );
}
