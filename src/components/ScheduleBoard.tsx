"use client";

import { useState } from "react";
import { addCalendarDays, appTodayKey, formatDateKeyLabel } from "@/lib/app-calendar";
import { isManualLfoFarm } from "@/lib/lfo/manualFarm";
import { useAppTimeZone } from "@/lib/useAppTimeZone";
import { isVisitPlaceFarm } from "@/lib/visits/visitPlace";
import { formWrite, localRecordId } from "@/lib/offline/formPairs";
import { selectDashboard, type ScheduleBoard as Board } from "@/lib/offline/selectDashboard";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { VISIT_TYPE_LABELS, VISIT_TYPE_OPTIONS } from "@/lib/utils";
import { DateKeyField } from "@/components/DateKeyField";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { PeekSheet } from "@/components/PeekSheet";
import { UpcomingCatchesList } from "@/components/UpcomingCatchesList";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader, Card, Select } from "@/components/ui";

const TITLES: Record<Exclude<Board, "dashboard">, string> = {
  today: "Today's Schedule",
  upcoming: "Upcoming Visits",
  catches: "Upcoming Catches",
};

type VisitBoard = Exclude<Board, "dashboard">;
type SheetMode = "visit" | "today" | "upcoming";

export function ScheduleBoard({ board }: { board: VisitBoard }) {
  const { snapshot } = useOffline();
  const { queue } = useReplicaWrite();
  const timeZone = useAppTimeZone();
  const data = selectDashboard(snapshot, null, board);
  const todayKey = appTodayKey(undefined, timeZone);
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [farmId, setFarmId] = useState("");
  const [date, setDate] = useState(todayKey);
  const [visitType, setVisitType] = useState<string>(VISIT_TYPE_OPTIONS[0].value);
  const [otherReason, setOtherReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const farms = (snapshot?.farms ?? [])
    .filter(
      (farm) => farm.isActive && !farm.deletedAt && !isVisitPlaceFarm(farm) && !isManualLfoFarm(farm),
    )
    .slice()
    .sort((a, b) => a.farmName.localeCompare(b.farmName));

  function openSheet(mode: SheetMode) {
    setError(null);
    setFarmId(farms[0]?.id ?? "");
    setDate(mode === "upcoming" ? addCalendarDays(todayKey, 1) : todayKey);
    setVisitType(VISIT_TYPE_OPTIONS[0].value);
    setOtherReason("");
    setSheet(mode);
  }

  function addVisit() {
    const nextLabel =
      visitType === "OTHER" ? otherReason.trim() : (VISIT_TYPE_LABELS[visitType] ?? visitType);
    const nextDate = sheet === "today" ? todayKey : date;
    if (!farmId || !nextDate) {
      setError("Choose a farm and a date.");
      return;
    }
    if (visitType === "OTHER" && !nextLabel) {
      setError("Enter a reason for this visit.");
      return;
    }
    if (sheet === "upcoming" && nextDate <= todayKey) {
      setError("Pick a date after today.");
      return;
    }
    const queued = queue(
      formWrite("addScheduleVisit", {
        id: localRecordId(),
        farmId,
        fields: { date: nextDate, label: nextLabel, farmId },
      }),
      { keepLocal: true },
    );
    if (!queued) {
      setError("Open the dashboard once so this phone has your farms.");
      return;
    }
    setSheet(null);
    setError(null);
  }

  const visits =
    board === "today"
      ? (data?.todaysSchedule ?? [])
      : (data?.upcomingSchedule ?? []).filter((row) => row.date > todayKey);

  return (
    <div>
      <BackHeader href="/" backLabel="Dashboard" title={TITLES[board]} />
      {error && !sheet ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      {!data ? (
        <Card>
          <p className="text-sm font-semibold text-stone-800">Could not load farms for this login.</p>
        </Card>
      ) : board === "catches" ? (
        <Card>
          <UpcomingCatchesList
            items={data.upcomingCatches}
            timeZone={timeZone}
            farms={snapshot?.farms}
            capped={false}
          />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openSheet("visit")}
              className="rounded-full bg-emerald-800 px-3 py-1.5 text-sm font-bold text-white"
            >
              Add visit
            </button>
            <button
              type="button"
              onClick={() => openSheet(board === "upcoming" ? "upcoming" : "today")}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-bold text-stone-800"
            >
              {board === "upcoming" ? "Add to upcoming" : "Add to today's schedule"}
            </button>
          </div>
          <FollowUpsDueList items={visits} showDate capped={false} />
        </Card>
      )}

      {sheet ? (
        <PeekSheet
          title={
            sheet === "today"
              ? "Add to today's schedule"
              : sheet === "upcoming"
                ? "Add to upcoming"
                : "Add visit"
          }
          onClose={() => setSheet(null)}
        >
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-semibold text-stone-700">
              Farm
              <select
                value={farmId}
                onChange={(event) => setFarmId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-stone-900"
              >
                {farms.length === 0 ? <option value="">No farms</option> : null}
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-stone-700">
              Visit type
              <Select
                value={visitType}
                onChange={(event) => setVisitType(event.target.value)}
                className="mt-1"
              >
                {VISIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
            {visitType === "OTHER" ? (
              <label className="block text-sm font-semibold text-stone-700">
                Reason
                <input
                  value={otherReason}
                  onChange={(event) => setOtherReason(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3 text-base text-stone-900"
                  placeholder="Reason for this visit"
                />
              </label>
            ) : null}
            {sheet === "today" ? (
              <p className="text-sm text-stone-600">
                Date <span className="font-semibold text-stone-900">{formatDateKeyLabel(todayKey, timeZone)}</span>
              </p>
            ) : (
              <DateKeyField id="schedule-visit-date" label="Date" value={date} onChange={setDate} />
            )}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              type="button"
              onClick={addVisit}
              className="w-full rounded-xl bg-emerald-800 px-3 py-3 text-base font-bold text-white"
            >
              Add
            </button>
          </div>
        </PeekSheet>
      ) : null}
    </div>
  );
}
