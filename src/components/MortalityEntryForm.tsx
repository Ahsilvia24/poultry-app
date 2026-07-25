"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { saveMortalityHouseSeriesAction } from "@/app/actions/mortality";
import {
  MORTALITY_DISCLAIMER,
  birdAgeFromPlacement,
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
    placementDate: string;
    houses: MortalityHousePayload[];
  } | null;
};

type DayRow = {
  age: number;
  mortalityDate: string;
  dailyMortalityCount: string;
  cullCount: string;
};

const CAUSES = Object.keys(MORTALITY_CAUSE_LABELS);

function draftKey(farmId: string, houseFlockId: string) {
  return `mortality-house-draft:${farmId}:${houseFlockId}`;
}

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function todayDate() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function buildRows(
  placementDate: string,
  house: MortalityHousePayload,
): DayRow[] {
  const placement = parseLocalDate(placementDate);
  const maxAge = birdAgeFromPlacement(placement, todayDate());
  const byDate = new Map(house.existingEntries.map((e) => [e.mortalityDate, e]));

  const rows: DayRow[] = [];
  for (let age = 0; age <= maxAge; age++) {
    const mortalityDate = format(addDays(placement, age), "yyyy-MM-dd");
    const existing = byDate.get(mortalityDate);
    rows.push({
      age,
      mortalityDate,
      dailyMortalityCount: existing ? String(existing.dailyMortalityCount) : "0",
      cullCount: existing ? String(existing.cullCount) : "0",
    });
  }
  return rows;
}

export function MortalityEntryForm({
  farms,
  initialFarmId,
  initialHouseFlockId,
  thresholds,
}: {
  farms: MortalityFarmPayload[];
  initialFarmId?: string;
  initialHouseFlockId?: string;
  thresholds: ThresholdSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [farmId, setFarmId] = useState(
    initialFarmId && farms.some((f) => f.id === initialFarmId)
      ? initialFarmId
      : farms.find((f) => f.activeFlock)?.id ?? farms[0]?.id ?? "",
  );

  const farm = useMemo(() => farms.find((f) => f.id === farmId) ?? null, [farms, farmId]);
  const flock = farm?.activeFlock ?? null;
  const houses = flock?.houses ?? [];

  const [houseFlockId, setHouseFlockId] = useState(() => {
    if (initialHouseFlockId && houses.some((h) => h.houseFlockId === initialHouseFlockId)) {
      return initialHouseFlockId;
    }
    return houses[0]?.houseFlockId ?? "";
  });

  const house = useMemo(
    () => houses.find((h) => h.houseFlockId === houseFlockId) ?? null,
    [houses, houseFlockId],
  );

  const [rows, setRows] = useState<DayRow[]>([]);
  const [mortalityCause, setMortalityCause] = useState("UNKNOWN");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalMortality: number;
    totalCulls: number;
    totalLoss: number;
    daysSaved: number;
    status: string;
    dailyPct: number;
    sevenDayPct: number;
    isDraft: boolean;
  } | null>(null);

  // Keep house selection valid when farm changes
  useEffect(() => {
    if (!flock || houses.length === 0) {
      setHouseFlockId("");
      setRows([]);
      return;
    }
    if (!houses.some((h) => h.houseFlockId === houseFlockId)) {
      setHouseFlockId(houses[0]!.houseFlockId);
    }
  }, [farmId, flock?.id, houses, houseFlockId]);

  useEffect(() => {
    if (!flock || !house) {
      setRows([]);
      return;
    }

    const key = draftKey(farmId, house.houseFlockId);
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          rows?: DayRow[];
          mortalityCause?: string;
          comments?: string;
        };
        if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          setRows(parsed.rows);
          setMortalityCause(parsed.mortalityCause ?? "UNKNOWN");
          setComments(parsed.comments ?? "");
          setDraftNotice("Restored local draft for this house.");
          return;
        }
      }
    } catch {
      // ignore corrupt drafts
    }

    setDraftNotice(null);
    const built = buildRows(flock.placementDate, house);
    setRows(built);
    const latestWithCause = [...house.existingEntries].reverse().find((e) => e.mortalityCause);
    setMortalityCause(latestWithCause?.mortalityCause ?? "UNKNOWN");
    setComments(latestWithCause?.comments ?? "");
  }, [farmId, flock?.id, flock?.placementDate, house?.houseFlockId]);

  function updateRow(age: number, patch: Partial<Pick<DayRow, "dailyMortalityCount" | "cullCount">>) {
    setRows((prev) => prev.map((r) => (r.age === age ? { ...r, ...patch } : r)));
    setSummary(null);
  }

  function saveDraftLocal() {
    if (!house) return;
    const key = draftKey(farmId, house.houseFlockId);
    sessionStorage.setItem(
      key,
      JSON.stringify({ rows, mortalityCause, comments }),
    );
    setDraftNotice("Draft saved on this device.");
  }

  function buildHouseWarning() {
    if (!house || rows.length === 0) return null;
    const last = rows[rows.length - 1]!;
    const loss = calcTotalDailyLoss(
      Number(last.dailyMortalityCount || 0),
      Number(last.cullCount || 0),
    );
    const dailyPct = calcPercentage(loss, house.placedBirdCount);
    const priorSeven = rows
      .slice(-7)
      .reduce(
        (s, r) =>
          s + calcTotalDailyLoss(Number(r.dailyMortalityCount || 0), Number(r.cullCount || 0)),
        0,
      );
    const sevenDayPct = calcPercentage(priorSeven, house.placedBirdCount);
    const status = resolveMortalityStatus({ dailyPct, sevenDayPct }, thresholds);
    return { status, dailyPct, sevenDayPct };
  }

  function submit(isDraft: boolean) {
    if (!flock || !house) {
      setError("Select a farm and house with an active flock");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveMortalityHouseSeriesAction({
        flockId: flock.id,
        houseFlockId: house.houseFlockId,
        mortalityCause,
        comments: comments || null,
        isDraft,
        entries: rows.map((r) => ({
          mortalityDate: r.mortalityDate,
          dailyMortalityCount: Number(r.dailyMortalityCount || 0),
          cullCount: Number(r.cullCount || 0),
        })),
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      const totalMortality = rows.reduce((s, r) => s + Number(r.dailyMortalityCount || 0), 0);
      const totalCulls = rows.reduce((s, r) => s + Number(r.cullCount || 0), 0);
      const warning = buildHouseWarning();
      setSummary({
        totalMortality,
        totalCulls,
        totalLoss: totalMortality + totalCulls,
        daysSaved: result?.count ?? rows.length,
        status: warning?.status ?? "Normal",
        dailyPct: warning?.dailyPct ?? 0,
        sevenDayPct: warning?.sevenDayPct ?? 0,
        isDraft,
      });

      const key = draftKey(farmId, house.houseFlockId);
      if (isDraft) {
        sessionStorage.setItem(
          key,
          JSON.stringify({ rows, mortalityCause, comments }),
        );
        setDraftNotice("Draft saved to server and this device.");
      } else {
        sessionStorage.removeItem(key);
        setDraftNotice(null);
      }
      router.refresh();
    });
  }

  function changeFarm(nextFarmId: string) {
    setFarmId(nextFarmId);
    setSummary(null);
    const nextFarm = farms.find((f) => f.id === nextFarmId);
    const firstHouse = nextFarm?.activeFlock?.houses[0]?.houseFlockId ?? "";
    setHouseFlockId(firstHouse);
    const qs = firstHouse
      ? `/mortality?farmId=${nextFarmId}&houseFlockId=${firstHouse}`
      : `/mortality?farmId=${nextFarmId}`;
    router.replace(qs);
  }

  function changeHouse(nextHouseId: string) {
    setHouseFlockId(nextHouseId);
    setSummary(null);
    router.replace(`/mortality?farmId=${farmId}&houseFlockId=${nextHouseId}`);
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
              onChange={(e) => changeFarm(e.target.value)}
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
            <Label htmlFor="houseFlockId">House</Label>
            <Select
              id="houseFlockId"
              value={houseFlockId}
              disabled={houses.length === 0}
              onChange={(e) => changeHouse(e.target.value)}
            >
              {houses.length === 0 ? (
                <option value="">No houses</option>
              ) : (
                houses.map((h) => (
                  <option key={h.houseFlockId} value={h.houseFlockId}>
                    House {h.houseNumber}
                  </option>
                ))
              )}
            </Select>
          </div>
        </div>

        {houses.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {houses.map((h) => (
              <button
                key={h.houseFlockId}
                type="button"
                onClick={() => changeHouse(h.houseFlockId)}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
                  h.houseFlockId === houseFlockId
                    ? "bg-emerald-700 text-white"
                    : "bg-stone-100 text-stone-800 hover:bg-stone-200"
                }`}
              >
                House {h.houseNumber}
              </button>
            ))}
          </div>
        ) : null}

        {flock && house ? (
          <p className="mt-3 text-sm text-stone-600">
            Flock <span className="font-semibold">{flock.flockNumber}</span> · House{" "}
            <span className="font-semibold">{house.houseNumber}</span> · Placed{" "}
            {formatNumber(house.placedBirdCount)} · Ages 0–{rows.length > 0 ? rows[rows.length - 1]!.age : 0}
          </p>
        ) : (
          <p className="mt-3 text-sm text-amber-800">This farm has no active flock or houses.</p>
        )}
        {draftNotice ? <p className="mt-2 text-sm text-emerald-800">{draftNotice}</p> : null}
      </Card>

      {house && rows.length > 0 ? (
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="mortalityCause">Primary cause</Label>
              <Select
                id="mortalityCause"
                value={mortalityCause}
                onChange={(e) => {
                  setMortalityCause(e.target.value);
                  setSummary(null);
                }}
              >
                {CAUSES.map((c) => (
                  <option key={c} value={c}>
                    {MORTALITY_CAUSE_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                rows={2}
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  setSummary(null);
                }}
              />
            </div>
          </div>

          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left">
                  <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2 font-semibold text-stone-600">
                    Age
                  </th>
                  <th className="px-3 py-2 font-semibold text-stone-600">Mortality</th>
                  <th className="px-3 py-2 font-semibold text-stone-600">Culls</th>
                  <th className="px-3 py-2 font-semibold text-stone-600">Loss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const loss = calcTotalDailyLoss(
                    Number(row.dailyMortalityCount || 0),
                    Number(row.cullCount || 0),
                  );
                  return (
                    <tr key={row.mortalityDate} className="border-b border-stone-100">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-stone-900">
                        {row.age}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Mortality day ${row.age}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className="min-h-11 px-3"
                          value={row.dailyMortalityCount}
                          onChange={(e) =>
                            updateRow(row.age, { dailyMortalityCount: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          aria-label={`Culls day ${row.age}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className="min-h-11 px-3"
                          value={row.cullCount}
                          onChange={(e) => updateRow(row.age, { cullCount: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-stone-800">{loss}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || !house} onClick={() => submit(false)}>
          {pending ? "Saving…" : "Save mortality"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !house}
          onClick={() => {
            saveDraftLocal();
            submit(true);
          }}
        >
          Save draft
        </Button>
        <Button type="button" variant="ghost" disabled={!house} onClick={saveDraftLocal}>
          Save on device only
        </Button>
      </div>

      {summary ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <h3 className="font-bold text-stone-900">
            {summary.isDraft ? "Draft saved" : "Saved"} — {summary.daysSaved} day
            {summary.daysSaved === 1 ? "" : "s"}
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
          {summary.status !== "Normal" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-amber-900">Threshold warning</span>
              <StatusBadge status={summary.status} />
              <span>
                Latest day {formatPct(summary.dailyPct)} · 7-day {formatPct(summary.sevenDayPct)}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">No threshold warnings for latest day.</p>
          )}
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {MORTALITY_DISCLAIMER}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
