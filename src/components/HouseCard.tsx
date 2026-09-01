"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HouseCardActions } from "@/components/HouseCardActions";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card } from "@/components/ui";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { compactCatchTimeLabel } from "@/lib/time-slots";
import { NumberKeypad, appendKeypadDigit, backspaceKeypadValue } from "@/components/NumberKeypad";
import { useKeypadNav } from "@/components/KeypadNavContext";
import { updateHouseLoggedTempAction } from "@/app/actions/farms";

type HouseData = {
  id: string;
  houseNumber: number;
  squareFootage: number;
  totalFanCFM: number | null;
  totalPowerCFM: number | null;
  numberOfFans: number | null;
  notes: string | null;
  placedBirdCount?: number | null;
  loggedTemp?: string | null;
  loggedTempAt?: string | null;
};

type Metrics = {
  cumulative: number;
  cumulativePct: number;
  remaining: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** e.g. 2 Sep 26 */
function formatHouseDetailDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

function daysBetweenKeys(fromKey: string, toKey: string): number | null {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;
  const a = new Date(y1, m1 - 1, d1, 12, 0, 0, 0).getTime();
  const b = new Date(y2, m2 - 1, d2, 12, 0, 0, 0).getTime();
  return Math.round((b - a) / 86400000);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HouseCard({
  farmId,
  house,
  hasFlock,
  status: _status,
  birdsPlaced,
  metrics,
  projectedHeadCount,
  projectedMortality,
  weeklyMortality,
  flockLabel = null,
  houseFlockId = null,
  placementDateKey = null,
  catchDateKey = null,
  catchTime = null,
  birdAgeDays = null,
}: {
  farmId: string;
  house: HouseData;
  hasFlock: boolean;
  status: string;
  birdsPlaced: number | null;
  metrics: Metrics | null;
  projectedHeadCount: number | null;
  projectedMortality: number | null;
  weeklyMortality: Array<{ week: number; total: number }>;
  flockLabel?: string | null;
  houseFlockId?: string | null;
  placementDateKey?: string | null;
  catchDateKey?: string | null;
  catchTime?: string | null;
  birdAgeDays?: number | null;
}) {
  const router = useRouter();
  const { setKeypadOpen } = useKeypadNav();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [tempOpen, setTempOpen] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [tempError, setTempError] = useState<string | null>(null);
  const [tempPending, startTemp] = useTransition();

  const loggedTempToday =
    house.loggedTemp && house.loggedTempAt === todayKey() ? house.loggedTemp : null;

  const mortalityValue = metrics ? formatNumber(metrics.cumulative) : "—";
  const mortalityPct = metrics ? formatPct(metrics.cumulativePct) : null;
  const projMortValue =
    projectedMortality != null ? formatNumber(projectedMortality) : "—";
  const projMortPct =
    projectedMortality != null && birdsPlaced != null && birdsPlaced > 0
      ? formatPct((projectedMortality / birdsPlaced) * 100)
      : null;
  const catchAgeDays =
    placementDateKey && catchDateKey
      ? daysBetweenKeys(placementDateKey, catchDateKey)
      : null;

  useEffect(() => {
    setKeypadOpen(tempOpen);
    return () => setKeypadOpen(false);
  }, [tempOpen, setKeypadOpen]);

  function openTemp() {
    setTempError(null);
    setTempValue(loggedTempToday ?? "");
    setTempOpen(true);
  }

  function closeTemp() {
    if (tempPending) return;
    setTempOpen(false);
    setTempError(null);
  }

  function saveTemp(next: string | null) {
    startTemp(async () => {
      const result = await updateHouseLoggedTempAction(farmId, house.id, next, todayKey());
      if (result?.error) {
        setTempError(result.error);
        return;
      }
      setTempOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="self-start">
    <SwipeCommitDeleteRow rowId={house.id} onDelete={() => setMode("delete")}>
        <Card className="rounded-xl">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="min-w-0 flex-1 text-left text-inherit"
              aria-label={`Edit house ${house.houseNumber}`}
            >
              <p className="text-lg font-bold">
                House {house.houseNumber}
                {birdAgeDays != null ? (
                  <span className="font-semibold text-stone-600"> {birdAgeDays}d</span>
                ) : null}
              </p>
              {metrics || projectedHeadCount != null ? (
                <p className="mt-0.5 text-sm font-semibold text-stone-600">
                  {metrics ? `M ${formatNumber(metrics.cumulative)}` : null}
                  {metrics && projectedHeadCount != null ? " · " : null}
                  {projectedHeadCount != null
                    ? `PHC ${formatNumber(projectedHeadCount)}`
                    : null}
                </p>
              ) : null}
            </button>
            <div className="flex shrink-0 items-start gap-2">
              <button
                type="button"
                onClick={openTemp}
                className={
                  loggedTempToday
                    ? "inline-flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center rounded-xl border-[1.5px] border-emerald-800 bg-white px-2.5 py-2"
                    : "inline-flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center rounded-xl border-[1.5px] border-stone-300 bg-stone-100 px-2.5 py-2"
                }
                aria-label={
                  loggedTempToday
                    ? `Edit temperature for house ${house.houseNumber}, currently ${loggedTempToday} degrees`
                    : `Log temperature for house ${house.houseNumber}`
                }
              >
                {loggedTempToday ? (
                  <>
                    <span className="text-lg font-extrabold leading-tight text-emerald-800">
                      {loggedTempToday}°
                    </span>
                    <span className="text-[10px] font-bold text-stone-500">Temp</span>
                  </>
                ) : (
                  <span className="text-center text-xs font-extrabold leading-tight text-stone-900">
                    Log
                    <br />
                    Temp
                  </span>
                )}
              </button>
              {hasFlock && houseFlockId ? (
                <a
                  href={`/mortality?farmId=${encodeURIComponent(farmId)}&houseFlockId=${encodeURIComponent(houseFlockId)}`}
                  className="inline-flex min-h-14 min-w-24 items-center justify-center rounded-xl bg-emerald-800 px-3 py-3 text-center text-sm font-extrabold leading-tight text-white hover:bg-emerald-900"
                  aria-label={`Enter mortality for house ${house.houseNumber}`}
                >
                  Enter
                  <br />
                  mortality
                </a>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMode("edit")}
            className="mt-3 w-full text-left text-inherit"
            aria-label={`Edit house ${house.houseNumber} weekly mortality`}
          >
            {weeklyMortality.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Weekly mortality
                </p>
                <WeeklyMortalityList weeks={weeklyMortality} />
              </div>
            ) : (
              <p className="text-sm text-stone-500">No weekly mortality yet.</p>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="mt-3 flex min-h-10 w-full items-center gap-2 border-t border-stone-100 pt-3 text-left text-sm font-semibold text-stone-700 hover:text-stone-900"
            aria-expanded={detailsOpen}
          >
            <span className="w-4 text-stone-500" aria-hidden="true">
              {detailsOpen ? "▾" : "▸"}
            </span>
            {detailsOpen ? "Hide Details" : "Show Details"}
          </button>

          {detailsOpen ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="mt-3 w-full space-y-3 text-left text-inherit"
              aria-label={`Edit house ${house.houseNumber} details`}
            >
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[13px] text-stone-500">Placed</p>
                  <p className="mt-0.5 text-[15px] font-bold">
                    {birdsPlaced != null ? formatNumber(birdsPlaced) : "—"}
                  </p>
                  {placementDateKey ? (
                    <p className="text-[15px] font-bold leading-snug">{formatHouseDetailDate(placementDateKey)}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[13px] text-stone-500">Remaining</p>
                  <p className="mt-0.5 text-[15px] font-bold">
                    {metrics ? formatNumber(metrics.remaining) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] text-stone-500">PHC</p>
                  <p className="mt-0.5 text-[15px] font-bold">
                    {projectedHeadCount != null ? formatNumber(projectedHeadCount) : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-400">150 catch crew</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[13px] text-stone-500">Catch</p>
                  {catchDateKey ? (
                    <p className="mt-0.5 text-[15px] font-bold leading-snug">
                      {formatHouseDetailDate(catchDateKey)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[15px] font-bold">—</p>
                  )}
                  {catchTime ? (
                    <p className="text-[15px] font-bold leading-snug">{compactCatchTimeLabel(catchTime)}</p>
                  ) : null}
                  {catchAgeDays != null ? (
                    <p className="text-[15px] font-bold leading-snug">{catchAgeDays} days</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[13px] text-stone-500">Mortality</p>
                  <p className="mt-0.5 text-[15px] font-bold">{mortalityValue}</p>
                  {mortalityPct ? (
                    <p className="text-[15px] font-bold leading-snug">({mortalityPct})</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[13px] text-stone-500">Proj. Mort.</p>
                  <p className="mt-0.5 text-[15px] font-bold">{projMortValue}</p>
                  {projMortPct ? (
                    <p className="text-[15px] font-bold leading-snug">({projMortPct})</p>
                  ) : null}
                </div>
              </div>
            </button>
          ) : null}
        </Card>
    </SwipeCommitDeleteRow>

      <HouseCardActions
        farmId={farmId}
        hasActiveFlock={hasFlock}
        mode={mode}
        onModeChange={setMode}
        house={{
          ...house,
          placedBirdCount: birdsPlaced ?? house.placedBirdCount ?? null,
          placementDateKey,
          catchDateKey,
          flockNumber: flockLabel,
          catchTime,
        }}
      />

      {tempOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={closeTemp}
        >
          <div
            className="rounded-t-xl bg-white pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pb-3">
              <p className="text-lg font-extrabold text-stone-900">
                House {house.houseNumber} temperature
              </p>
              <p className="mt-3 text-center text-4xl font-extrabold tabular-nums text-stone-900">
                {tempValue ? `${tempValue}°` : "—"}
              </p>
              {tempError ? <p className="mt-2 text-sm text-red-700">{tempError}</p> : null}
              {loggedTempToday || tempValue ? (
                <button
                  type="button"
                  disabled={tempPending}
                  onClick={() => saveTemp(null)}
                  className="mt-3 w-full text-center text-sm font-bold text-stone-600"
                >
                  Clear temperature
                </button>
              ) : null}
            </div>
            <NumberKeypad
              allowDecimal
              onDigit={(d) => setTempValue((v) => appendKeypadDigit(v, d, true))}
              onBackspace={() => {
                if (!tempValue) closeTemp();
                else setTempValue((v) => backspaceKeypadValue(v));
              }}
              onEnter={() => saveTemp(tempValue.trim() || null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
