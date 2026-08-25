"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  formatHouseLfoSummary,
} from "@/lib/lfo/calculate";

export type LfoHouseRow = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
  feedUpAt: string | null;
  headCount: number;
};

/** Half-hour slots: top (:00) and bottom (:30) of each hour. */
const FEED_UP_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  const label = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
  return { value, label };
});

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function splitFeedUp(feedUpAt: string) {
  if (!feedUpAt) return { date: "", time: "" };
  const [date = "", timePart = ""] = feedUpAt.split("T");
  const raw = timePart.slice(0, 5);
  if (!raw) return { date, time: "" };
  const [hStr, mStr] = raw.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { date, time: "" };
  // Snap to nearest :00 or :30
  const total = h * 60 + m;
  const snapped = Math.round(total / 30) * 30;
  const sh = Math.floor((snapped % (24 * 60)) / 60);
  const sm = snapped % 60;
  return {
    date,
    time: `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`,
  };
}

function joinFeedUp(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function CopySummaryButton({
  lines,
  farmName,
}: {
  lines: string[];
  farmName?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        const name = farmName?.trim();
        const text = name ? [name, ...lines].join("\n") : lines.join("\n");
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      className="shrink-0 text-sm font-semibold text-emerald-800 hover:underline"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function LfoInventoryForm({
  action,
  saveAsNewAction,
  houses: initialHouses,
  orderDate,
  farmName,
  consumptionRate: initialRate = DEFAULT_LFO_CONSUMPTION_RATE,
  asOf = null,
  submitLabel,
  deleteAction,
}: {
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  saveAsNewAction?: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  houses: LfoHouseRow[];
  orderDate: string;
  farmName?: string;
  consumptionRate?: number;
  /** Frozen clock for hours-until-off / order math. Omit on a new LFO. */
  asOf?: Date | string | null;
  submitLabel: string;
  deleteAction?: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [consumptionRate, setConsumptionRate] = useState(String(initialRate));
  const [rows, setRows] = useState(
    initialHouses.map((h) => {
      const parts = splitFeedUp(h.feedUpAt ?? "");
      return {
        houseId: h.houseId,
        houseNumber: h.houseNumber,
        headCount: h.headCount,
        binAPounds: String(h.binAPounds),
        binBPounds: String(h.binBPounds),
        feedUpDate: parts.date,
        feedUpTime: parts.time,
      };
    }),
  );

  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      now: asOf ? new Date(asOf) : undefined,
      houses: rows.map((r) => ({
        houseId: r.houseId,
        houseNumber: r.houseNumber,
        headCount: r.headCount,
        binAPounds: Number(r.binAPounds) || 0,
        binBPounds: Number(r.binBPounds) || 0,
        feedUpAt: joinFeedUp(r.feedUpDate, r.feedUpTime) || null,
      })),
    });
  }, [asOf, consumptionRate, orderDate, rows]);

  const houseSummary = useMemo(() => formatHouseLfoSummary(calc.houses), [calc.houses]);

  function updateRow(
    houseId: string,
    patch: Partial<(typeof rows)[number]>,
  ) {
    setRows((prev) => prev.map((r) => (r.houseId === houseId ? { ...r, ...patch } : r)));
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (result?.ok) setSaved(true);
        });
      }}
      className="space-y-4"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>
      ) : null}

      {asOf ? (
        <p className="text-sm text-stone-600">
          Numbers as of{" "}
          <span className="font-semibold text-stone-800">
            {format(new Date(asOf), "MMM d, yyyy, h:mm a")}
          </span>
          . Hours, head counts, and order/reclaim stay frozen to that time. Save as new
          LFO to capture current time and remaining birds.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="orderDate">Order date</Label>
          <Input id="orderDate" name="orderDate" type="date" required defaultValue={orderDate} />
        </div>
        <div>
          <Label htmlFor="consumptionRate">Consumption rate (lbs/bird/day)</Label>
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
          />
        </div>
      </div>

      <div>
        <div className="space-y-4">
          {rows.map((house) => {
            const result = calc.houses.find((h) => h.houseId === house.houseId);
            const feedUpAt = joinFeedUp(house.feedUpDate, house.feedUpTime);
            return (
              <div
                key={house.houseId}
                className="space-y-3 border-b border-stone-100 pb-4 last:border-0 last:pb-0"
              >
                <input type="hidden" name="houseId" value={house.houseId} />
                <input type="hidden" name="feedUpAt" value={feedUpAt} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[calc(0.875rem+2pt)] font-bold text-stone-800">
                    House {house.houseNumber}
                  </p>
                  <p className="text-xs text-stone-500">
                    Head count {house.headCount.toLocaleString()}
                    {asOf ? " at save" : ""}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor={`binA-${house.houseId}`}>Bin A Inventory (lbs)</Label>
                    <Input
                      id={`binA-${house.houseId}`}
                      name="binAPounds"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={house.binAPounds}
                      onChange={(e) => updateRow(house.houseId, { binAPounds: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`binB-${house.houseId}`}>Bin B Inventory (lbs)</Label>
                    <Input
                      id={`binB-${house.houseId}`}
                      name="binBPounds"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={house.binBPounds}
                      onChange={(e) => updateRow(house.houseId, { binBPounds: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`feedUpDate-${house.houseId}`}>Feed up date</Label>
                    <Input
                      id={`feedUpDate-${house.houseId}`}
                      type="date"
                      value={house.feedUpDate}
                      onChange={(e) => updateRow(house.houseId, { feedUpDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`feedUpTime-${house.houseId}`}>Feed up time</Label>
                    <Select
                      id={`feedUpTime-${house.houseId}`}
                      value={house.feedUpTime}
                      onChange={(e) => updateRow(house.houseId, { feedUpTime: e.target.value })}
                      className="mt-1"
                    >
                      <option value="">Select time</option>
                      {FEED_UP_TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                {result ? (
                  <dl className="grid grid-cols-1 gap-3 text-sm text-stone-600 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Feed off (−5h)</dt>
                      <dd className="font-medium text-stone-800">
                        {result.feedOffAt
                          ? format(result.feedOffAt, "MMM d, h:mm a")
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Hours until feed off</dt>
                      <dd className="font-medium text-stone-800">
                        {result.hoursUntilFeedOff == null
                          ? "—"
                          : formatHours(result.hoursUntilFeedOff)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Hourly consumption</dt>
                      <dd className="font-medium text-stone-800">
                        {formatLbs(result.hourlyConsumptionLbs)} lbs/hr
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Feed used until off</dt>
                      <dd className="font-medium text-stone-800">
                        {result.feedConsumedUntilOffLbs == null
                          ? "—"
                          : `${formatLbs(result.feedConsumedUntilOffLbs)} lbs`}
                      </dd>
                    </div>
                    {result.rawOrderLbs != null && result.rawOrderLbs > 0 ? (
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-stone-500">LFO</dt>
                        <dd className="font-medium text-stone-800">
                          {formatLbs(result.rawOrderLbs)} lbs
                        </dd>
                      </div>
                    ) : result.rawReclaimLbs != null && result.rawReclaimLbs > 0 ? (
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-stone-500">Reclaim</dt>
                        <dd className="font-medium text-stone-800">
                          {formatLbs(result.rawReclaimLbs)} lbs
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 sm:block">
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
      </div>

      {houseSummary.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <div className="min-w-0 flex-1 space-y-0.5">
            {houseSummary.map((line) => (
              <p key={line} className="font-semibold text-stone-900">
                {line}
              </p>
            ))}
          </div>
          <CopySummaryButton lines={houseSummary} farmName={farmName} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {saveAsNewAction ? (
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            formAction={(formData) => {
              setError(null);
              setSaved(false);
              startTransition(async () => {
                const result = await saveAsNewAction(formData);
                if (result?.error) {
                  setError(result.error);
                }
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
