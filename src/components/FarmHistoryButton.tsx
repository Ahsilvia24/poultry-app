"use client";

import { ReplicaLink } from "@/components/ReplicaLink";
import { Button } from "@/components/ui";

export function FarmHistoryButton() {
  return (
    <ReplicaLink href="/history">
      <Button compact>Farm History</Button>
    </ReplicaLink>
  );
}
