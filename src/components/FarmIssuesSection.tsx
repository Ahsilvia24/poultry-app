"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { FarmIssueForm } from "@/components/FarmOpsForms";
import { Card } from "@/components/ui";
import { ISSUE_CATEGORY_LABELS } from "@/lib/utils";

type IssueRow = {
  id: string;
  dateReported: string;
  priority: string;
  status: string;
  category: string;
  description: string;
};

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#issues") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div id="issues" className="scroll-mt-24">
      {open ? (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold">Recent issues</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (window.location.hash === "#issues") {
                  history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {issues.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {issues.map((issue) => (
              <li key={issue.id} className="border-b border-stone-100 pb-2">
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
              </li>
            ))}
          </ul>
          <h4 className="mt-6 font-bold">Report issue</h4>
          <FarmIssueForm farmId={farmId} flockId={flockId} houses={houses} />
        </Card>
      ) : null}
    </div>
  );
}
