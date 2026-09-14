"use client";

import { FarmIssueFormView } from "@/components/FarmIssueFormView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias } from "@/lib/offline/remapIds";
import { selectIssue, selectIssues } from "@/lib/offline/selectIssues";

export function FarmIssueFormPageClient({
  farmId,
  issueId,
}: {
  farmId: string;
  issueId?: string;
}) {
  const { snapshot, ready, aliases } = useOffline();
  const listHref = `/farms/${farmId}/issues`;

  if (snapshotHasFarmGraph(snapshot)) {
    const resolvedFarmId = resolveAlias(aliases, farmId);
    const model = selectIssues(snapshot, resolvedFarmId);
    if (!model) {
      return (
        <div>
          <BackHeader href="/farms" backLabel="Farms" title="Issue" />
          <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        </div>
      );
    }
    if (issueId) {
      const issue = selectIssue(snapshot, resolvedFarmId, resolveAlias(aliases, issueId));
      if (!issue) {
        return (
          <div>
            <BackHeader href={listHref} backLabel="Issues" title="Issue" />
            <p className="text-sm font-semibold text-stone-800">This issue is not on the phone yet.</p>
          </div>
        );
      }
      return (
        <FarmIssueFormView
          farmId={model.farmId}
          flockId={model.activeFlockId}
          houses={model.houses}
          issue={issue}
        />
      );
    }
    return (
      <FarmIssueFormView farmId={model.farmId} flockId={model.activeFlockId} houses={model.houses} />
    );
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Issues" title={issueId ? "Edit Issue" : "Log Issue"} />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening issue…"}
      </p>
    </div>
  );
}
