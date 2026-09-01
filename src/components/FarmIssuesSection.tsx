"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { deleteIssueAction } from "@/app/actions/ops";
import { EditRecordButton } from "@/components/DeleteRecordButton";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { FarmIssueForm, type IssueFormValues } from "@/components/FarmOpsForms";
import { FarmLogSectionHeader, FarmLogSectionTop } from "@/components/FarmLogSectionChrome";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { Card } from "@/components/ui";
import { ISSUE_CATEGORY_LABELS } from "@/lib/utils";

type IssueRow = IssueFormValues & {
  id: string;
};

function issuesHashActive() {
  return typeof window !== "undefined" && window.location.hash === "#issues";
}

export function FarmIssuesSection({
  farmId,
  flockId,
  houses,
  issues,
}: {
  farmId: string;
  flockId?: string;
  houses: Array<{ id: string; houseNumber: number }>;
  issues: IssueRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  useEffect(() => {
    if (issuesHashActive()) setOpen(true);

    function onHashChange() {
      if (issuesHashActive()) {
        setOpen(true);
        setFormOpen(false);
        setEditingId(null);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function afterIssueSaved() {
    setFormOpen(false);
    setEditingId(null);
    setOpen(true);
    if (!issuesHashActive()) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#issues`,
      );
    }
  }

  if (!open) return <div id="issues" className="scroll-mt-24" />;

  return (
    <div id="issues" className="scroll-mt-24">
      <FarmLogSectionHeader
        title="Recent Issues"
        logLabel="Log Issue"
        onLog={() => {
          setEditingId(null);
          setFormOpen((open) => !open);
        }}
      />
      <ExclusiveSwipeGroup>
      <ul className="space-y-0.5 text-base">
        {issues.length === 0 ? <li className="text-stone-500">None yet</li> : null}
        {issues.map((issue) => (
          <li key={issue.id} className="border-b border-stone-100 py-0.5 last:border-0">
            <SwipeCommitDeleteRow
              rowId={issue.id}
              transparent
              onDelete={() => {
                startDelete(async () => {
                  await deleteIssueAction(farmId, issue.id);
                  router.refresh();
                });
              }}
            >
              <div className="flex min-h-[38px] items-center justify-between gap-3 py-1">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {format(new Date(issue.dateReported + "T12:00:00"), "MMM d, yyyy")}
                    </span>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-bold">
                      {issue.priority}
                    </span>
                    <span className="text-xs text-stone-500">{issue.status}</span>
                  </div>
                  <p>
                    {ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category}: {issue.description}
                  </p>
                </div>
                <EditRecordButton
                  label="Edit issue"
                  active={editingId === issue.id}
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId((id) => (id === issue.id ? null : issue.id));
                  }}
                />
              </div>
            </SwipeCommitDeleteRow>
            {editingId === issue.id ? (
              <FarmIssueForm
                farmId={farmId}
                flockId={flockId}
                houses={houses}
                recordId={issue.id}
                initial={issue}
                onSuccess={afterIssueSaved}
              />
            ) : null}
          </li>
        ))}
      </ul>
      </ExclusiveSwipeGroup>

      {formOpen ? (
        <Card className="mt-3">
          <FarmIssueForm
            farmId={farmId}
            flockId={flockId}
            houses={houses}
            onSuccess={afterIssueSaved}
          />
        </Card>
      ) : null}
      <FarmLogSectionTop />
    </div>
  );
}
