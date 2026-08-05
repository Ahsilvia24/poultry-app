"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteIssueAction } from "@/app/actions/ops";
import { FarmIssueForm, type IssueFormValues } from "@/components/FarmOpsForms";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
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
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function closeSection() {
    setOpen(false);
    setFormOpen(false);
    setEditingId(null);
    if (issuesHashActive()) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

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
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">Recent issues</h3>
          <button
            type="button"
            onClick={closeSection}
            className="text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Close
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {issues.length === 0 ? <li className="text-stone-500">None yet</li> : null}
          {issues.map((issue) => (
            <li key={issue.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
              <SwipeToDeleteRow
                deleteLabel="Delete issue"
                editLabel="Edit issue"
                confirmMessage="Delete this issue? This cannot be undone."
                onEdit={() => {
                  setFormOpen(false);
                  setEditingId((id) => (id === issue.id ? null : issue.id));
                }}
                onDelete={() => deleteIssueAction(farmId, issue.id)}
              >
                <div className="min-w-0 py-0.5">
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
              </SwipeToDeleteRow>
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
      </Card>

      {!formOpen ? (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
          className="mt-3 text-sm text-emerald-800 hover:underline"
        >
          Report issue
        </button>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-sm text-emerald-800 hover:underline"
          >
            Report issue
          </button>
          <Card className="mt-3">
            <FarmIssueForm
              farmId={farmId}
              flockId={flockId}
              houses={houses}
              onSuccess={afterIssueSaved}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
