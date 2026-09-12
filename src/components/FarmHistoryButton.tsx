"use client";

import { ReplicaLink } from "@/components/ReplicaLink";

export function FarmHistoryButton() {
  return (
    <ReplicaLink
      href="/history"
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
    >
      Farm History
    </ReplicaLink>
  );
}
