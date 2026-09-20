"use client";

import { BackCaret } from "@/components/ui";
import { useOfflineNav } from "@/components/OfflineNavContext";

export function ReplicaFarmMissing({ farmId: _farmId }: { farmId: string }) {
  const nav = useOfflineNav();

  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
        onClick={() => nav?.navigate("/farms")}
      >
        <BackCaret />
        Farms
      </button>
      <p className="mt-4 text-sm font-semibold text-stone-800">This farm is not on this phone.</p>
      <p className="mt-1 text-sm text-stone-500">
        Import app data from the phone that has it, or add the farm here.
      </p>
    </div>
  );
}
