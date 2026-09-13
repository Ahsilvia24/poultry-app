"use client";

import { ReplicaLink } from "@/components/ReplicaLink";
import { Button } from "@/components/ui";

export function FarmHistoryButton() {
  return (
    <ReplicaLink href="/history">
      <Button className="min-h-10 px-4 text-sm">Farm History</Button>
    </ReplicaLink>
  );
}
