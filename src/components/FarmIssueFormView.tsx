"use client";

import { FarmIssueForm } from "@/components/FarmOpsForms";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { BackHeader, Card } from "@/components/ui";
import type { IssueListRow } from "@/lib/offline/selectIssues";

export function FarmIssueFormView({
  farmId,
  flockId,
  houses,
  issue,
}: {
  farmId: string;
  flockId?: string | null;
  houses: Array<{ id: string; houseNumber: number }>;
  issue?: IssueListRow | null;
}) {
  const nav = useOfflineNav();
  const listHref = `/farms/${farmId}/issues`;

  function afterSave() {
    if (nav) nav.navigate(listHref);
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Issues" title={issue ? "Edit Issue" : "Log Issue"} />
      <Card>
        <FarmIssueForm
          farmId={farmId}
          flockId={flockId}
          houses={houses}
          recordId={issue?.id}
          initial={issue ?? undefined}
          onSuccess={afterSave}
        />
      </Card>
    </div>
  );
}
