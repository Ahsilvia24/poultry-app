"use client";

import { deleteIssueAction } from "@/app/actions/ops";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { FarmLogListTile } from "@/components/FarmLogListTile";
import { ReplicaLink } from "@/components/ReplicaLink";
import { BackHeader } from "@/components/ui";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import { ISSUE_CATEGORY_LABELS } from "@/lib/utils";
import { useHiddenReplicaDeletes } from "@/lib/offline/useHiddenReplicaDeletes";
import type { IssuesPageModel } from "@/lib/offline/selectIssues";

export function FarmIssuesView({ model }: { model: IssuesPageModel }) {
  const { visible, remove } = useHiddenReplicaDeletes();
  const issues = visible(model.issues);

  return (
    <div>
      <BackHeader href={`/farms/${model.farmId}`} backLabel="Farm" title="Issues" />

      <ReplicaLink
        href={`/farms/${model.farmId}/issues/new`}
        className="mb-4 flex min-h-11 items-center justify-center rounded-[10px] bg-emerald-700 px-3 py-2.5 text-center text-[15px] font-bold text-white hover:bg-emerald-800"
      >
        Log Issue
      </ReplicaLink>

      {issues.length === 0 ? (
        <p className="text-stone-500">No issues yet.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="space-y-2.5">
            {issues.map((issue) => {
              const title = ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category;
              const dateLabel = formatServiceShortDate(issue.dateReported);
              return (
                <FarmLogListTile
                  key={issue.id}
                  rowId={issue.id}
                  href={`/farms/${model.farmId}/issues/${issue.id}`}
                  title={title}
                  subtitle={dateLabel}
                  ariaLabel={`View or edit ${title} ${dateLabel}`}
                  onDelete={() =>
                    remove(
                      issue.id,
                      "deleteIssue",
                      { id: issue.id, farmId: model.farmId },
                      () => deleteIssueAction(model.farmId, issue.id),
                    )
                  }
                />
              );
            })}
          </div>
        </ExclusiveSwipeGroup>
      )}
    </div>
  );
}
