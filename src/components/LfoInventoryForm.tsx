"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  feedUpAtFromCatch,
  formatLfoOrderClock,
} from "@/lib/lfo/calculate";
import { formatFeedMillData } from "@/lib/lfo/feedMillData";
import { formatConsumptionRate } from "@/lib/lfo/consumptionRate";
import { HALF_HOUR_TIME_OPTIONS, currentHalfHourTime, normalizeHalfHourTime } from "@/lib/time-slots";

export type LfoHouseRow = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
  catchDate: string;
  catchTime: string;
  headCount: number;
};

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function FeedMillDataButton({
  getText,
  onBeforeCopy,
}: {
  getText: () => string;
  onBeforeCopy?: () => Promise<boolean> | boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Button
      type="button"
      onClick={async () => {
        if (onBeforeCopy) {
          const ok = await onBeforeCopy();
          if (!ok) return;
        }
        const text = getText();
        if (!text.trim()) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : "Feed Mill Data"}
    </Button>
  );
}

function PairField({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

export function LfoInventoryForm({
  action,
  saveAsNewAction,
  houses: initialHouses,
  orderDate: initialOrderDate,
  orderTime: initialOrderTime,
  consumptionRate: initialRate = DEFAULT_LFO_CONSUMPTION_RATE,
  asOf = null,
  notes = null,
  submitLabel,
  deleteAction,
}: {
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  saveAsNewAction?: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  houses: LfoHouseRow[];
  orderDate: string;
  orderTime?: string | null;
  farmName?: string;
  consumptionRate?: number;
  /** Frozen clock for hours-until-off / order math. Omit on a new LFO. */
  asOf?: Date | string | null;
  notes?: string | null;
  submitLabel: string;
  deleteAction?: () => Promise<void>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const returnAfterSave = Boolean(saveAsNewAction);

  function leaveAfterSave() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/lfo");
  }
  const [pending, startTransition] = useTransition();
  const [consumptionRate, setConsumptionRate] = useState(() =>
    formatConsumptionRate(initialRate),
  );
  const [orderDate, setOrderDate] = useState(initialOrderDate);
  const [orderTime, setOrderTime] = useState(
    () => normalizeHalfHourTime(initialOrderTime) ?? currentHalfHourTime(),
  );
  const [rows, setRows] = useState(
    initialHouses.map((h) => ({
      houseId: h.houseId,
      houseNumber: h.houseNumber,
      headCount: h.headCount,
      binAPounds: String(h.binAPounds),
      binBPounds: String(h.binBPounds),
      catchDate: h.catchDate,
      catchTime: h.catchTime,
    })),
  );

  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      orderTime,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: rows.map((r) => ({
        houseId: r.houseId,
        houseNumber: r.houseNumber,
        headCount: r.headCount,
        binAPounds: Number(r.binAPounds) || 0,
        binBPounds: Number(r.binBPounds) || 0,
        feedUpAt: feedUpAtFromCatch(r.catchDate, r.catchTime),
      })),
    });
  }, [consumptionRate, orderDate, orderTime, rows]);

  const feedMillText = useMemo(
    () =>
      formatFeedMillData(
        rows.map((row) => {
          const result = calc.houses.find((house) => house.houseId === row.houseId);
          return {
            houseNumber: row.houseNumber,
            binAPounds: Number(row.binAPounds) || 0,
            binBPounds: Number(row.binBPounds) || 0,
            orderLbs: result?.orderLbs ?? null,
            reclaimLbs: result?.reclaimLbs ?? null,
          };
        }),
      ),
    [calc.houses, rows],
  );

  function updateRow(houseId: string, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r) => (r.houseId === houseId ? { ...r, ...patch } : r)));
  }

  async function persistInPlace() {
    const form = formRef.current;
    if (!form) return false;
    setError(null);
    setSaved(false);
    const result = await action(new FormData(form));
    if (result?.error) {
      setError(result.error);
      return false;
    }
    setSaved(true);
    return true;
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (returnAfterSave) {
            leaveAfterSave();
            return;
          }
          if (result?.ok) setSaved(true);
        });
      }}
      className="space-y-3"
    >
      {notes ? <input type="hidden" name="notes" value={notes} /> : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>
      ) : null}

      {formatLfoOrderClock(orderDate, orderTime) ? (
        <p className="text-sm text-stone-600">
          Hours until feed off are measured from{" "}
          <span className="font-semibold text-stone-800">
            {formatLfoOrderClock(orderDate, orderTime)}
          </span>
          {asOf ? (
            <>
              . Head counts stay frozen to{" "}
              <span className="font-semibold text-stone-800">
                {format(new Date(asOf), "MMM d, yyyy, h:mm a")}
              </span>
            </>
          ) : null}
          . Save as new LFO to capture current remaining birds.
        </p>
      ) : asOf ? (
        <p className="text-sm text-stone-600">
          Head counts stay frozen to{" "}
          <span className="font-semibold text-stone-800">
            {format(new Date(asOf), "MMM d, yyyy, h:mm a")}
          </span>
          .
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <PairField>
          <Label htmlFor="orderDate">Order date</Label>
          <Input
            id="orderDate"
            name="orderDate"
            type="date"
            required
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="mt-0.5"
            compact
          />
        </PairField>
        <PairField>
          <Label htmlFor="orderTime">Order time</Label>
          <Select
            id="orderTime"
            name="orderTime"
            value={orderTime}
            onChange={(e) => setOrderTime(e.target.value)}
            className="mt-0.5"
            compact
          >
            {HALF_HOUR_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </PairField>
      </div>
      <div className="mt-2">
        <Label htmlFor="consumptionRate">Consumption rate</Label>
        <Input
          id="consumptionRate"
          name="consumptionRate"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          required
          value={consumptionRate}
          onChange={(e) => setConsumptionRate(e.target.value)}
          className="mt-0.5"
          compact
        />
      </div>
      <p className="text-xs text-stone-500">Consumption rate in lbs/bird/day</p>
      {formatLfoOrderClock(orderDate, orderTime) ? (
        <p className="text-xs text-stone-500">
          Hours from {formatLfoOrderClock(orderDate, orderTime)}
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.map((house) => {
          const result = calc.houses.find((h) => h.houseId === house.houseId);
          const feedUpAt = feedUpAtFromCatch(house.catchDate, house.catchTime) ?? "";
          return (
            <div
              key={house.houseId}
              className="space-y-2 border-b border-stone-100 pb-3 last:border-0 last:pb-0"
            >
              <input type="hidden" name="houseId" value={house.houseId} />
              <input type="hidden" name="feedUpAt" value={feedUpAt} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-stone-800">House {house.houseNumber}</p>
                <p className="text-xs text-stone-500">
                  Head Count {house.headCount.toLocaleString()}
                  {asOf ? " at save" : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PairField>
                  <Label htmlFor={`binA-${house.houseId}`}>Bin A (lbs)</Label>
                  <Input
                    id={`binA-${house.houseId}`}
                    name="binAPounds"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={house.binAPounds}
                    onChange={(e) => updateRow(house.houseId, { binAPounds: e.target.value })}
                    className="mt-0.5"
                    compact
                  />
                </PairField>
                <PairField>
                  <Label htmlFor={`binB-${house.houseId}`}>Bin B (lbs)</Label>
                  <Input
                    id={`binB-${house.houseId}`}
                    name="binBPounds"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={house.binBPounds}
                    onChange={(e) => updateRow(house.houseId, { binBPounds: e.target.value })}
                    className="mt-0.5"
                    compact
                  />
                </PairField>
                <PairField>
                  <Label htmlFor={`catchDate-${house.houseId}`}>Catch date</Label>
                  <Input
                    id={`catchDate-${house.houseId}`}
                    type="date"
                    value={house.catchDate}
                    onChange={(e) => updateRow(house.houseId, { catchDate: e.target.value })}
                    className="mt-0.5"
                    compact
                  />
                </PairField>
                <PairField>
                  <Label htmlFor={`catchTime-${house.houseId}`}>Catch time</Label>
                  <Select
                    id={`catchTime-${house.houseId}`}
                    value={house.catchTime}
                    onChange={(e) => updateRow(house.houseId, { catchTime: e.target.value })}
                    className="mt-0.5"
                    compact
                  >
                    <option value="">Select time</option>
                    {HALF_HOUR_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </PairField>
              </div>
              {house.catchTime ? (
                <button
                  type="button"
                  onClick={() => updateRow(house.houseId, { catchTime: "" })}
                  className="ml-auto block text-xs font-bold text-stone-500"
                >
                  Clear time
                </button>
              ) : null}
              {result ? (
                <dl className="space-y-1 text-sm text-stone-600">
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Feed up (−5)</dt>
                    <dd className="font-medium text-stone-800">
                      {result.feedUpAt ? format(result.feedUpAt, "MMM d, h:mm a") : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Feed off (−10)</dt>
                    <dd className="font-medium text-stone-800">
                      {result.feedOffAt ? format(result.feedOffAt, "MMM d, h:mm a") : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Hours until feed off</dt>
                    <dd className="font-medium text-stone-800">
                      {result.hoursUntilFeedOff == null
                        ? "—"
                        : formatHours(result.hoursUntilFeedOff)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Hourly consumption</dt>
                    <dd className="font-medium text-stone-800">
                      {formatLbs(result.hourlyConsumptionLbs)} lbs/hr
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Feed used until off</dt>
                    <dd className="font-medium text-stone-800">
                      {result.feedConsumedUntilOffLbs == null
                        ? "—"
                        : `${formatLbs(result.feedConsumedUntilOffLbs)} lbs`}
                    </dd>
                  </div>
                  {result.rawOrderLbs != null && result.rawOrderLbs > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-stone-500">LFO</dt>
                      <dd className="font-medium text-stone-800">
                        {formatLbs(result.rawOrderLbs)} lbs
                      </dd>
                    </div>
                  ) : result.rawReclaimLbs != null && result.rawReclaimLbs > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-stone-500">Reclaim</dt>
                      <dd className="font-medium text-stone-800">
                        {formatLbs(result.rawReclaimLbs)} lbs
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">
                      {result.orderLbs != null && result.orderLbs > 0
                        ? "LFO (rounded)"
                        : result.reclaimLbs != null && result.reclaimLbs > 0
                          ? "Reclaim (rounded)"
                          : "LFO / reclaim (rounded)"}
                    </dt>
                    <dd className="font-semibold text-stone-900">
                      {result.balanceLbs == null
                        ? "—"
                        : result.orderLbs != null && result.orderLbs > 0
                          ? `Order ${formatLbs(result.orderLbs)} lbs`
                          : result.reclaimLbs != null && result.reclaimLbs > 0
                            ? `Reclaim ${formatLbs(result.reclaimLbs)} lbs`
                            : "Even — no order or reclaim"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          );
        })}
      </div>

      <FeedMillDataButton
        getText={() => feedMillText}
        onBeforeCopy={() => persistInPlace()}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="border-2 border-emerald-950"
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
        {saveAsNewAction ? (
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="border-2 border-emerald-800"
            formAction={(formData) => {
              setError(null);
              setSaved(false);
              startTransition(async () => {
                const result = await saveAsNewAction(formData);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                leaveAfterSave();
              });
            }}
          >
            {pending ? "Saving…" : "Save as new LFO"}
          </Button>
        ) : null}
        <Link href="/lfo" className="text-sm font-semibold text-stone-600 hover:text-stone-900">
          Back to LFOs
        </Link>
        {deleteAction ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this LFO?")) return;
              startTransition(async () => {
                await deleteAction();
              });
            }}
            className="ml-auto text-sm font-semibold text-red-700 hover:text-red-900"
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
