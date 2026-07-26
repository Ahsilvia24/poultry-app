"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function LfoCreateBar({
  farms,
}: {
  farms: Array<{ id: string; farmName: string }>;
}) {
  const router = useRouter();
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const selected = useMemo(
    () => farms.find((f) => f.id === farmId) ?? farms[0] ?? null,
    [farms, farmId],
  );

  if (farms.length === 0) {
    return (
      <p className="mb-6 text-sm text-stone-600">
        Add an active farm with a flock before creating an LFO.
      </p>
    );
  }

  return (
    <div className="mb-6">
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {farms.map((f) => {
          const active = (selected?.id ?? farmId) === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFarmId(f.id)}
              className={cn(
                "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
                active ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-800",
              )}
            >
              {f.farmName}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        className="w-full min-h-10 rounded-xl px-4 text-[15px]"
        onClick={() => {
          if (!selected) return;
          router.push(`/lfo/new/${selected.id}`);
        }}
      >
        Create LFO
      </Button>
    </div>
  );
}
