"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HouseCardActions } from "@/components/HouseCardActions";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card } from "@/components/ui";
import { compactCatchTimeLabel } from "@/lib/time-slots";
import { NumberKeypad, appendKeypadDigit, backspaceKeypadValue } from "@/components/NumberKeypad";
import { useKeypadNav } from "@/components/KeypadNavContext";
import { useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** e.g. Wed 29 Jul 26 */
function formatHouseDetailDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return `${WEEKDAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]} ${String(y).slice(-2)}`;
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
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(house.id);

  useEffect(() => {
    if (!isOpenOwner) setSwipeX(0);
  }, [isOpenOwner]);
  const [tempOpen, setTempOpen] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const [tempError, setTempError] = useState<string | null>(null);
  const [tempPending, startTemp] = useTransition();

  const loggedTempToday =
    house.loggedTemp && house.loggedTempAt === todayKey() ? house.loggedTemp : null;

  const mortalityValue = metrics
    ? `${formatNumber(metrics.cumulative)} (${formatPct(metrics.cumulativePct)})`
    : "—";
  const projMortValue =
    projectedMortality != null && birdsPlaced != null && birdsPlaced > 0
      ? `${formatNumber(projectedMortality)} (${formatPct((projectedMortality / birdsPlaced) * 100)})`
      : projectedMortality != null
        ? formatNumber(projectedMortality)
        : "—";

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    const dx = x - touchStartX.current;
    // Only allow left swipe reveal
    setSwipeX(Math.max(-88, Math.min(0, dx)));
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    // Snap open if swiped far enough left
    if (swipeX <= -48) {
      setSwipeX(-88);
      requestOpen();
    } else {
      setSwipeX(0);
      requestClose();
    }
    touchStartX.current = null;
  }

  const swipeOpen = swipeX < -8;

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
    <div className="relative overflow-hidden rounded-xl">
      {/* Only mount while swiping so a stretched grid row can't reveal it under a short tile */}
      {swipeOpen ? (
        <div
          className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-xl bg-red-700"
          aria-hidden={swipeX > -40}
        >
          <button
            type="button"
            onClick={() => {
              setSwipeX(0);
              setMode("delete");
            }}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm font-bold text-white"
            aria-label={`Delete house ${house.houseNumber}`}
          >
            Delete
          </button>
        </div>
      ) : null}

      <div
        className="relative transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStartX.current = null;
          setSwipeX(0);
        }}
      >
        <Card>
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
            {detailsOpen ? "Hide details" : "Show details"}
          </button>

          {detailsOpen ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="mt-3 w-full space-y-3 text-left text-sm text-inherit"
              aria-label={`Edit house ${house.houseNumber} details`}
            >
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-stone-500">Placed</p>
                  <p className="font-semibold">
                    {birdsPlaced != null ? formatNumber(birdsPlaced) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Remaining</p>
                  <p className="font-semibold">
                    {metrics ? formatNumber(metrics.remaining) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">PHC</p>
                  <p className="font-semibold">
                    {projectedHeadCount != null ? formatNumber(projectedHeadCount) : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-400">150 catch crew</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-stone-500">Placed/Catch</p>
                  {placementDateKey ? (
                    <p className="font-semibold leading-snug">
                      {formatHouseDetailDate(placementDateKey)}
                    </p>
                  ) : (
                    <p className="font-semibold">—</p>
                  )}
                  {catchDateKey ? (
                    <p className="font-semibold leading-snug">
                      <span className="block">{formatHouseDetailDate(catchDateKey)}</span>
                      {catchTime ? (
                        <span className="block">{compactCatchTimeLabel(catchTime)}</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-stone-500">Mortality</p>
                  <p className="font-semibold">{mortalityValue}</p>
                </div>
                <div>
                  <p className="text-stone-500">Proj. Mort.</p>
                  <p className="font-semibold">{projMortValue}</p>
                </div>
              </div>
            </button>
          ) : null}
        </Card>
      </div>
    </div>

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
