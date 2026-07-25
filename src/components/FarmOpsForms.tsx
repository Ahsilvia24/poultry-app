"use client";

import { useTransition } from "react";
import {
  createIssueAction,
  createLitterEventAction,
  createVisitAction,
} from "@/app/actions/ops";
import { archiveFarmAction, completeFlockAction } from "@/app/actions/farms";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
  VISIT_TYPE_LABELS,
} from "@/lib/utils";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export function FarmVisitForm({
  farmId,
  flockId,
}: {
  farmId: string;
  flockId?: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          await createVisitAction(fd);
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      {flockId ? <input type="hidden" name="flockId" value={flockId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="visitDate">Visit date</Label>
          <Input
            id="visitDate"
            name="visitDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor="visitType">Visit type</Label>
          <Select id="visitType" name="visitType" defaultValue="ROUTINE_SERVICE">
            {Object.entries(VISIT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="birdAgeInDays">Bird age (days)</Label>
          <Input id="birdAgeInDays" name="birdAgeInDays" type="number" min={0} />
        </div>
        <div>
          <Label htmlFor="generalBirdCondition">Bird condition</Label>
          <Input id="generalBirdCondition" name="generalBirdCondition" />
        </div>
        <div>
          <Label htmlFor="temperature">Temperature</Label>
          <Input id="temperature" name="temperature" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="humidity">Humidity</Label>
          <Input id="humidity" name="humidity" type="number" step="any" />
        </div>
      </div>
      <div>
        <Label htmlFor="visitNotes">Notes</Label>
        <Textarea id="visitNotes" name="notes" rows={2} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="followUpRequired" className="h-5 w-5" />
        Follow-up required
      </label>
      <div>
        <Label htmlFor="followUpDate">Follow-up date</Label>
        <Input id="followUpDate" name="followUpDate" type="date" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save visit"}
      </Button>
    </form>
  );
}

export function FarmIssueForm({
  farmId,
  houses,
  flockId,
}: {
  farmId: string;
  houses: { id: string; houseNumber: number }[];
  flockId?: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          await createIssueAction(fd);
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      {flockId ? <input type="hidden" name="flockId" value={flockId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="dateReported">Date reported</Label>
          <Input
            id="dateReported"
            name="dateReported"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor="houseId">House (optional)</Label>
          <Select id="houseId" name="houseId" defaultValue="">
            <option value="">Entire farm</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                House {h.houseNumber}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue="OTHER">
            {Object.entries(ISSUE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue="OPEN">
            <option value="OPEN">Open</option>
            <option value="MONITORING">Monitoring</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="assignedTo">Assigned to</Label>
          <Input id="assignedTo" name="assignedTo" />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required rows={2} />
      </div>
      <div>
        <Label htmlFor="correctiveAction">Corrective action</Label>
        <Textarea id="correctiveAction" name="correctiveAction" rows={2} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save issue"}
      </Button>
    </form>
  );
}

export function LitterEventForm({
  farmId,
  houses,
}: {
  farmId: string;
  houses: { id: string; houseNumber: number }[];
}) {
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          await createLitterEventAction(fd);
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="eventDate">Event date</Label>
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor="eventType">Event type</Label>
          <Select id="eventType" name="eventType" defaultValue="FULL_LITTER_CLEANOUT">
            {Object.entries(LITTER_EVENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="litterHouseId">House (optional)</Label>
          <Select id="litterHouseId" name="houseId" defaultValue="">
            <option value="">Entire farm</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                House {h.houseNumber}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="contractor">Contractor</Label>
          <Input id="contractor" name="contractor" />
        </div>
        <div>
          <Label htmlFor="litterDepth">Litter depth</Label>
          <Input id="litterDepth" name="litterDepth" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="cost">Cost</Label>
          <Input id="cost" name="cost" type="number" step="any" min={0} />
        </div>
      </div>
      <div>
        <Label htmlFor="litterNotes">Notes</Label>
        <Textarea id="litterNotes" name="notes" rows={2} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save litter event"}
      </Button>
    </form>
  );
}

export function ArchiveFarmButton({ farmId }: { farmId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Archive this farm? It will be hidden from active lists but historical data is kept.",
          )
        ) {
          start(async () => {
            await archiveFarmAction(farmId);
          });
        }
      }}
    >
      Archive farm
    </Button>
  );
}

export function CompleteFlockButton({ flockId }: { flockId: string }) {
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
      Complete flock
    </Button>
  );
}
