"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMortalityBatchAction } from "@/app/actions/mortality";
import {
  MORTALITY_DISCLAIMER,
  calcPercentage,
  calcTotalDailyLoss,
  resolveMortalityStatus,
} from "@/lib/mortality/calculations";
import { MORTALITY_CAUSE_LABELS, formatNumber, formatPct } from "@/lib/utils";
import type { ThresholdSettings } from "@/types";
import { Button, Card, Input, Label, Select, StatusBadge, Textarea } from "@/components/ui";

export type MortalityHousePayload = {
  houseFlockId: string;
  houseNumber: number;
  placedBirdCount: number;
  existingEntries: Array<{
    mortalityDate: string;
    dailyMortalityCount: number;
    cullCount: number;
    mortalityCause: string;
    comments: string | null;
    isDraft: boolean;
  }>;
};

export type MortalityFarmPayload = {
  id: string;
  farmName: string;
  activeFlock: {
    id: string;
    flockNumber: string;
    houses: MortalityHousePayload[];
  } | null;
};

type HouseFormRow = {
  houseFlockId: string;
  dailyMortalityCount: string;
  cullCount: string;
  mortalityCause: string;
  comments: string;
};

const CAUSES = Object.keys(MORTALITY_CAUSE_LABELS);

function draftKey(farmId: string, flockId: string, date: string) {
  return `mortality-draft:${farmId}:${flockId}:${date}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyRows(houses: MortalityHousePayload[]): HouseFormRow[] {
  return houses.map((h) => ({
    houseFlockId: h.houseFlockId,
    dailyMortalityCount: "0",
    cullCount: "0",
    mortalityCause: "UNKNOWN",
    comments: "",
  }));
}

function rowsFromEntries(
  houses: MortalityHousePayload[],
  date: string,
): HouseFormRow[] {
  return houses.map((h) => {
    const existing = h.existingEntries.find((e) => e.mortalityDate === date);
    if (!existing) {
      return {
        houseFlockId: h.houseFlockId,
        dailyMortalityCount: "0",
        cullCount: "0",
        mortalityCause: "UNKNOWN",
        comments: "",
      };
    }
    return {
      houseFlockId: h.houseFlockId,
      dailyMortalityCount: String(existing.dailyMortalityCount),
      cullCount: String(existing.cullCount),
      mortalityCause: existing.mortalityCause,
      comments: existing.comments ?? "",
    };
  });
}

export function MortalityEntryForm({
  farms,
  initialFarmId,
  thresholds,
}: {
  farms: MortalityFarmPayload[];
  initialFarmId?: string;
  thresholds: ThresholdSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [farmId, setFarmId] = useState(
    initialFarmId && farms.some((f) => f.id === initialFarmId)
      ? initialFarmId
      : farms.find((f) => f.activeFlock)?.id ?? farms[0]?.id ?? "",
  );
  const [mortalityDate, setMortalityDate] = useState(todayISO);
  const [rows, setRows] = useState<HouseFormRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalMortality: number;
    totalCulls: number;
    totalLoss: number;
    birdAgeInDays: number;
    warnings: Array<{ houseNumber: number; status: string; dailyPct: number; sevenDayPct: number }>;
    isDraft: boolean;
  } | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  const farm = useMemo(() => farms.find((f) => f.id === farmId) ?? null, [farms, farmId]);
  const flock = farm?.activeFlock ?? null;
  const houses = flock?.houses ?? [];
  const housesKey = houses.map((h) => h.houseFlockId).join(",");

  useEffect(() => {
    if (!flock || houses.length === 0) {
      setRows([]);
      return;
    }

    const key = draftKey(farmId, flock.id, mortalityDate);
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as HouseFormRow[];
        if (Array.isArray(parsed) && parsed.length === houses.length) {
          setRows(parsed);
          setDraftNotice("Restored local draft for this date.");
          return;
        }
      }
    } catch {
      // ignore corrupt drafts
    }

    setDraftNotice(null);
    const fromDb = rowsFromEntries(houses, mortalityDate);
    const hasExisting = houses.some((h) =>
      h.existingEntries.some((e) => e.mortalityDate === mortalityDate),
    );
    setRows(hasExisting ? fromDb : emptyRows(houses));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when farm/flock/date/house set changes
  }, [farmId, flock?.id, mortalityDate, housesKey]);

  function updateRow(index: number, patch: Partial<HouseFormRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setSummary(null);
  }

  function saveDraftLocal() {
    if (!flock) return;
    const key = draftKey(farmId, flock.id, mortalityDate);
    sessionStorage.setItem(key, JSON.stringify(rows));
    setDraftNotice("Draft saved on this device.");
  }

  function buildWarnings() {
    return houses.map((h, i) => {
      const row = rows[i];
      const loss = calcTotalDailyLoss(
        Number(row?.dailyMortalityCount || 0),
        Number(row?.cullCount || 0),
      );
      const dailyPct = calcPercentage(loss, h.placedBirdCount);
      const priorSeven = h.existingEntries
        .filter((e) => e.mortalityDate !== mortalityDate && e.mortalityDate <= mortalityDate)
        .slice(-6)
        .reduce((s, e) => s + calcTotalDailyLoss(e.dailyMortalityCount, e.cullCount), 0);
      const sevenDayPct = calcPercentage(priorSeven + loss, h.placedBirdCount);
      const status = resolveMortalityStatus({ dailyPct, sevenDayPct }, thresholds);
      return { houseNumber: h.houseNumber, status, dailyPct, sevenDayPct };
    });
  }

  function submit(isDraft: boolean) {
    if (!flock) {
      setError("Select a farm with an active flock");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveMortalityBatchAction({
        flockId: flock.id,
        mortalityDate,
        entries: rows.map((r) => ({
          houseFlockId: r.houseFlockId,
          dailyMortalityCount: Number(r.dailyMortalityCount || 0),
          cullCount: Number(r.cullCount || 0),
          mortalityCause: r.mortalityCause,
          comments: r.comments || null,
          isDraft,
        })),
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      const totalMortality = rows.reduce((s, r) => s + Number(r.dailyMortalityCount || 0), 0);
      const totalCulls = rows.reduce((s, r) => s + Number(r.cullCount || 0), 0);
      setSummary({
        totalMortality,
        totalCulls,
        totalLoss: totalMortality + totalCulls,
        birdAgeInDays: result?.birdAgeInDays ?? 0,
        warnings: buildWarnings().filter((w) => w.status !== "Normal"),
        isDraft,
      });

      const key = draftKey(farmId, flock.id, mortalityDate);
      if (isDraft) {
        sessionStorage.setItem(key, JSON.stringify(rows));
        setDraftNotice("Draft saved to server and this device.");
      } else {
        sessionStorage.removeItem(key);
        setDraftNotice(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="farmId">Farm</Label>
            <Select
              id="farmId"
              value={farmId}
              onChange={(e) => {
                setFarmId(e.target.value);
                setSummary(null);
                router.replace(`/mortality?farmId=${e.target.value}`);
              }}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id} disabled={!f.activeFlock}>
                  {f.farmName}
                  {!f.activeFlock ? " (no active flock)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="mortalityDate">Date</Label>
            <Input
              id="mortalityDate"
              type="date"
              value={mortalityDate}
              onChange={(e) => {
                setMortalityDate(e.target.value);
                setSummary(null);
              }}
            />
          </div>
        </div>
        {flock ? (
          <p className="mt-3 text-sm text-stone-600">
            Active flock <span className="font-semibold">{flock.flockNumber}</span> ·{" "}
            {houses.length} house{houses.length === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="mt-3 text-sm text-amber-800">This farm has no active flock.</p>
        )}
        {draftNotice ? <p className="mt-2 text-sm text-emerald-800">{draftNotice}</p> : null}
      </Card>

      {houses.length > 0 ? (
        <div className="space-y-3">
          {houses.map((house, index) => {
            const row = rows[index];
            if (!row) return null;
            return (
              <Card key={house.houseFlockId}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold">House {house.houseNumber}</h3>
                  <p className="text-sm text-stone-600">
                    Placed {formatNumber(house.placedBirdCount)}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor={`mort-${house.houseFlockId}`}>Mortality</Label>
                    <Input
                      id={`mort-${house.houseFlockId}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.dailyMortalityCount}
                      onChange={(e) => updateRow(index, { dailyMortalityCount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cull-${house.houseFlockId}`}>Culls</Label>
                    <Input
                      id={`cull-${house.houseFlockId}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.cullCount}
                      onChange={(e) => updateRow(index, { cullCount: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`cause-${house.houseFlockId}`}>Primary cause</Label>
                    <Select
                      id={`cause-${house.houseFlockId}`}
                      value={row.mortalityCause}
                      onChange={(e) => updateRow(index, { mortalityCause: e.target.value })}
                    >
                      {CAUSES.map((c) => (
                        <option key={c} value={c}>
                          {MORTALITY_CAUSE_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Label htmlFor={`comments-${house.houseFlockId}`}>Comments</Label>
                    <Textarea
                      id={`comments-${house.houseFlockId}`}
                      rows={2}
                      value={row.comments}
                      onChange={(e) => updateRow(index, { comments: e.target.value })}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || !flock} onClick={() => submit(false)}>
          {pending ? "Saving…" : "Save mortality"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !flock}
          onClick={() => {
            saveDraftLocal();
            submit(true);
          }}
        >
          Save draft
        </Button>
        <Button type="button" variant="ghost" disabled={!flock} onClick={saveDraftLocal}>
          Save on device only
        </Button>
      </div>

      {summary ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <h3 className="font-bold text-stone-900">
            {summary.isDraft ? "Draft saved" : "Saved"} — day {summary.birdAgeInDays}
          </h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-stone-500">Mortality</p>
              <p className="text-xl font-bold">{summary.totalMortality}</p>
            </div>
            <div>
              <p className="text-stone-500">Culls</p>
              <p className="text-xl font-bold">{summary.totalCulls}</p>
            </div>
            <div>
              <p className="text-stone-500">Total loss</p>
              <p className="text-xl font-bold">{summary.totalLoss}</p>
            </div>
          </div>
          {summary.warnings.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="font-semibold text-amber-900">Threshold warnings</p>
              {summary.warnings.map((w) => (
                <div key={w.houseNumber} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>House {w.houseNumber}</span>
                  <StatusBadge status={w.status} />
                  <span>
                    Daily {formatPct(w.dailyPct)} · 7-day {formatPct(w.sevenDayPct)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">No threshold warnings for this entry.</p>
          )}
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {MORTALITY_DISCLAIMER}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
