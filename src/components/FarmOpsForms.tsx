"use client";

import { useState, useTransition } from "react";
import {
  createIssueAction,
  createLitterEventAction,
  createVisitAction,
  updateIssueAction,
  updateLitterEventAction,
  updateVisitAction,
} from "@/app/actions/ops";
import {
  deactivateFarmAction,
  deleteFarmAction,
  reactivateFarmAction,
  completeFlockAction,
  reactivateFlockAction,
  deleteFlockAction,
} from "@/app/actions/farms";
import { birdAgeFromPlacement } from "@/lib/mortality/calculations";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
  VISIT_TYPE_LABELS,
} from "@/lib/utils";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export type VisitFormValues = {
  visitDate: string;
  visitType: string;
  birdAgeInDays?: number | null;
  generalBirdCondition?: string | null;
  notes?: string | null;
  followUpRequired?: boolean;
  followUpDate?: string | null;
};

function parseVisitDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function FarmVisitForm({
  farmId,
  flockId,
  placementDate,
  onSuccess,
  recordId,
  initial,
}: {
  farmId: string;
  flockId?: string | null;
  /** Active flock placement date (`yyyy-MM-dd`) for auto bird age. */
  placementDate?: string | null;
  onSuccess?: () => void;
  recordId?: string;
  initial?: VisitFormValues;
}) {
  const [pending, start] = useTransition();
  const [visitDate, setVisitDate] = useState(
    initial?.visitDate ?? new Date().toISOString().slice(0, 10),
  );
  const fid = (name: string) => (recordId ? `${recordId}-${name}` : name);

  const birdAgeInDays =
    placementDate != null && visitDate
      ? birdAgeFromPlacement(parseVisitDateKey(placementDate), parseVisitDateKey(visitDate))
      : null;

  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          const result = recordId
            ? await updateVisitAction(recordId, fd)
            : await createVisitAction(fd);
          if (!result || !("error" in result) || !result.error) {
            onSuccess?.();
          }
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      {flockId ? <input type="hidden" name="flockId" value={flockId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={fid("visitDate")}>Visit date</Label>
          <Input
            id={fid("visitDate")}
            name="visitDate"
            type="date"
            required
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={fid("visitType")}>Visit type</Label>
          <Select
            id={fid("visitType")}
            name="visitType"
            defaultValue={initial?.visitType ?? "ROUTINE_SERVICE"}
          >
            {Object.entries(VISIT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("birdAgeInDays")}>Bird age (days)</Label>
          <Input
            id={fid("birdAgeInDays")}
            type="text"
            readOnly
            value={birdAgeInDays != null ? String(birdAgeInDays) : "—"}
            className="bg-stone-50 text-stone-700"
          />
        </div>
        <div>
          <Label htmlFor={fid("generalBirdCondition")}>Bird condition</Label>
          <Input
            id={fid("generalBirdCondition")}
            name="generalBirdCondition"
            defaultValue={initial?.generalBirdCondition ?? "Healthy"}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={fid("visitNotes")}>Notes</Label>
        <Textarea
          id={fid("visitNotes")}
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? undefined}
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="followUpRequired"
          className="h-5 w-5"
          defaultChecked={initial?.followUpRequired ?? false}
        />
        Follow-up required
      </label>
      <div>
        <Label htmlFor={fid("followUpDate")}>Follow-up date</Label>
        <Input
          id={fid("followUpDate")}
          name="followUpDate"
          type="date"
          defaultValue={initial?.followUpDate ?? undefined}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : recordId ? "Save changes" : "Save visit"}
      </Button>
    </form>
  );
}

export type IssueFormValues = {
  dateReported: string;
  houseId?: string | null;
  category: string;
  priority: string;
  status: string;
  assignedTo?: string | null;
  description: string;
  correctiveAction?: string | null;
};

export function FarmIssueForm({
  farmId,
  houses,
  flockId,
  onSuccess,
  recordId,
  initial,
}: {
  farmId: string;
  houses: { id: string; houseNumber: number }[];
  flockId?: string | null;
  onSuccess?: () => void;
  recordId?: string;
  initial?: IssueFormValues;
}) {
  const [pending, start] = useTransition();
  const fid = (name: string) => (recordId ? `${recordId}-${name}` : name);
  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          const result = recordId
            ? await updateIssueAction(recordId, fd)
            : await createIssueAction(fd);
          if (!result || !("error" in result) || !result.error) {
            onSuccess?.();
          }
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      {flockId ? <input type="hidden" name="flockId" value={flockId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={fid("dateReported")}>Date reported</Label>
          <Input
            id={fid("dateReported")}
            name="dateReported"
            type="date"
            required
            defaultValue={initial?.dateReported ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor={fid("houseId")}>House (optional)</Label>
          <Select id={fid("houseId")} name="houseId" defaultValue={initial?.houseId ?? ""}>
            <option value="">Entire farm</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                House {h.houseNumber}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("category")}>Category</Label>
          <Select id={fid("category")} name="category" defaultValue={initial?.category ?? "OTHER"}>
            {Object.entries(ISSUE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("priority")}>Priority</Label>
          <Select id={fid("priority")} name="priority" defaultValue={initial?.priority ?? "MEDIUM"}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("status")}>Status</Label>
          <Select id={fid("status")} name="status" defaultValue={initial?.status ?? "OPEN"}>
            <option value="OPEN">Open</option>
            <option value="MONITORING">Monitoring</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("assignedTo")}>Assigned to</Label>
          <Input
            id={fid("assignedTo")}
            name="assignedTo"
            defaultValue={initial?.assignedTo ?? undefined}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={fid("description")}>Description</Label>
        <Textarea
          id={fid("description")}
          name="description"
          required
          rows={2}
          defaultValue={initial?.description}
        />
      </div>
      <div>
        <Label htmlFor={fid("correctiveAction")}>Corrective action</Label>
        <Textarea
          id={fid("correctiveAction")}
          name="correctiveAction"
          rows={2}
          defaultValue={initial?.correctiveAction ?? undefined}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : recordId ? "Save changes" : "Save issue"}
      </Button>
    </form>
  );
}

export type LitterFormValues = {
  eventDate: string;
  eventType: string;
  houseId?: string | null;
  contractor?: string | null;
  litterDepth?: number | null;
  cost?: number | null;
  notes?: string | null;
};

export function LitterEventForm({
  farmId,
  houses,
  onSuccess,
  recordId,
  initial,
}: {
  farmId: string;
  houses: { id: string; houseNumber: number }[];
  onSuccess?: () => void;
  recordId?: string;
  initial?: LitterFormValues;
}) {
  const [pending, start] = useTransition();
  const fid = (name: string) => (recordId ? `${recordId}-${name}` : name);
  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          const result = recordId
            ? await updateLitterEventAction(recordId, fd)
            : await createLitterEventAction(fd);
          if (!result || !("error" in result) || !result.error) {
            onSuccess?.();
          }
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={fid("eventDate")}>Event date</Label>
          <Input
            id={fid("eventDate")}
            name="eventDate"
            type="date"
            required
            defaultValue={initial?.eventDate ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor={fid("eventType")}>Event type</Label>
          <Select
            id={fid("eventType")}
            name="eventType"
            defaultValue={initial?.eventType ?? "FULL_LITTER_CLEANOUT"}
          >
            {Object.entries(LITTER_EVENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("litterHouseId")}>House (optional)</Label>
          <Select
            id={fid("litterHouseId")}
            name="houseId"
            defaultValue={initial?.houseId ?? ""}
          >
            <option value="">Entire farm</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                House {h.houseNumber}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("contractor")}>Contractor</Label>
          <Input
            id={fid("contractor")}
            name="contractor"
            defaultValue={initial?.contractor ?? undefined}
          />
        </div>
        <div>
          <Label htmlFor={fid("litterDepth")}>Litter depth</Label>
          <Input
            id={fid("litterDepth")}
            name="litterDepth"
            type="number"
            step="any"
            defaultValue={initial?.litterDepth ?? undefined}
          />
        </div>
        <div>
          <Label htmlFor={fid("cost")}>Cost</Label>
          <Input
            id={fid("cost")}
            name="cost"
            type="number"
            step="any"
            min={0}
            defaultValue={initial?.cost ?? undefined}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={fid("litterNotes")}>Notes</Label>
        <Textarea
          id={fid("litterNotes")}
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? undefined}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : recordId ? "Save changes" : "Save litter event"}
      </Button>
    </form>
  );
}

export function DeactivateFarmButton({
  farmId,
  appearance = "button",
}: {
  farmId: string;
  appearance?: "button" | "icon" | "badge";
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      {appearance === "badge" ? (
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Make farm inactive"
          title="Make inactive"
          className="inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-sm font-bold text-emerald-900 hover:bg-emerald-200 disabled:opacity-50"
        >
          Active
        </button>
      ) : appearance === "icon" ? (
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Make farm inactive"
          title="Make inactive"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 hover:text-stone-800 disabled:opacity-50"
        >
          <PauseIcon className="h-5 w-5" />
        </button>
      ) : (
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(true)}>
          Make inactive
        </Button>
      )}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-farm-title"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="deactivate-farm-title" className="text-lg font-bold text-stone-900">
              Make this farm inactive?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              It will move to Inactive. You can make it active again later. Historical records stay
              intact.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    await deactivateFarmAction(farmId);
                  });
                }}
              >
                {pending ? "Working…" : "Make inactive"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ReactivateFarmButton({
  farmId,
  appearance = "button",
}: {
  farmId: string;
  appearance?: "button" | "text" | "badge";
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  if (appearance === "badge") {
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Make farm active"
          title="Make active"
          className="inline-flex rounded-md bg-stone-100 px-2.5 py-1 text-sm font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-50"
        >
          Inactive
        </button>
        {open ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reactivate-farm-title"
              className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="reactivate-farm-title" className="text-lg font-bold text-stone-900">
                Make this farm active?
              </h3>
              <p className="mt-2 text-sm text-stone-600">
                It will move back to Active and show up in your normal farm lists.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      await reactivateFarmAction(farmId);
                    });
                  }}
                >
                  {pending ? "Working…" : "Make active"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (appearance === "text") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            await reactivateFarmAction(farmId);
          });
        }}
        className="px-2 py-2 text-sm font-semibold text-emerald-800 hover:underline disabled:opacity-50"
      >
        {pending ? "Working…" : "Make active"}
      </button>
    );
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await reactivateFarmAction(farmId);
        });
      }}
    >
      {pending ? "Working…" : "Make active"}
    </Button>
  );
}

export function DeleteFarmButton({
  farmId,
  appearance = "button",
}: {
  farmId: string;
  appearance?: "button" | "icon";
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      {appearance === "icon" ? (
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Delete farm permanently"
          title="Delete permanently"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      ) : (
        <Button type="button" variant="danger" disabled={pending} onClick={() => setOpen(true)}>
          Delete farm
        </Button>
      )}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-farm-title"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
          >
            <h3 id="delete-farm-title" className="text-lg font-bold text-stone-900">
              Delete this farm permanently?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              It will disappear from Active and Inactive lists. This cannot be undone from the app.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    await deleteFarmAction(farmId);
                  });
                }}
              >
                {pending ? "Working…" : "Delete permanently"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** @deprecated Use DeactivateFarmButton / DeleteFarmButton */
export function ArchiveFarmButton({ farmId }: { farmId: string }) {
  return <DeactivateFarmButton farmId={farmId} />;
}

export function CompleteFlockButton({
  flockId,
  label = "Complete flock",
}: {
  flockId: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (confirm("Mark this flock as completed?")) {
          start(async () => {
            await completeFlockAction(flockId);
          });
        }
      }}
    >
      {label}
    </Button>
  );
}

export function ReactivateFlockButton({
  flockId,
  flockNumber,
}: {
  flockId: string;
  flockNumber?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          const label = flockNumber ? `flock ${flockNumber}` : "this flock";
          if (!confirm(`Make ${label} active again?`)) return;
          setError(null);
          start(async () => {
            const result = await reactivateFlockAction(flockId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Working…" : "Make active"}
      </Button>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

export function DeleteFlockButton({
  flockId,
  flockNumber,
}: {
  flockId: string;
  flockNumber?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          const label = flockNumber ? `flock ${flockNumber}` : "this flock";
          if (
            !confirm(
              `Delete ${label}? This removes it from history. This cannot be undone.`,
            )
          ) {
            return;
          }
          setError(null);
          start(async () => {
            const result = await deleteFlockAction(flockId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
