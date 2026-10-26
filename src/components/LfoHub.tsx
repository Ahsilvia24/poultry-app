"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { FarmLfoForm, type FarmLfoHouseInput } from "@/components/FarmLfoForm";
import { ManualLfoForm } from "@/components/ManualLfoForm";
import { SavedLfoRow } from "@/components/SavedLfoRow";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { SettingsValueChip, settingsValueTextClass } from "@/components/SettingsLayout";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { lfoTabFromRoute } from "@/lib/lfo/defaultTab";
import { writeReplicaUrl } from "@/lib/offline/replicaHistory";
import type { LfoShareInventory } from "@/lib/lfo/share-payload";

export const MANUAL_LFO_TAB_ID = "manual";

export function LfoHub({
  farms,
  savedLfos,
  initialFarmId,
}: {
  farms: Array<{ id: string; farmName: string; houses: FarmLfoHouseInput[] }>;
  savedLfos: Array<{
    id: string;
    farmName: string;
    dateLabel: string;
    houseSummary: string[];
    shareInventory: LfoShareInventory;
  }>;
  initialFarmId?: string;
}) {
  const nav = useOfflineNav();
  const [tab, setTab] = useState(() => {
    const fromRoute = lfoTabFromRoute(initialFarmId, MANUAL_LFO_TAB_ID);
    return fromRoute !== MANUAL_LFO_TAB_ID && farms.some((f) => f.id === fromRoute)
      ? fromRoute
      : MANUAL_LFO_TAB_ID;
  });

  function persistTab(id: string) {
    const href = id === MANUAL_LFO_TAB_ID ? "/lfo" : `/lfo?farmId=${id}`;
    const already = id === MANUAL_LFO_TAB_ID ? !initialFarmId : initialFarmId === id;
    if (already) return;
    if (nav) nav.replace(href);
    else writeReplicaUrl(href, "replace");
  }

  function selectTab(id: string) {
    setTab(id);
    persistTab(id);
  }

  const isManual = tab === MANUAL_LFO_TAB_ID;
  const selected = farms.find((f) => f.id === tab) ?? null;

  const pickerLabel =
    tab === MANUAL_LFO_TAB_ID ? "Quick Calc." : (selected?.farmName ?? "Quick Calc.");

  return (
    <div>
      <SettingsValueChip className="mb-3 w-full min-w-0">
        <select
          aria-label={`Last feed order, ${pickerLabel}`}
          value={tab}
          onChange={(event) => selectTab(event.target.value)}
          className={`${settingsValueTextClass.replace("text-right", "text-left")} min-w-0 cursor-pointer`}
        >
          <option value={MANUAL_LFO_TAB_ID}>Quick Calc.</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.farmName}
            </option>
          ))}
        </select>
      </SettingsValueChip>

      {isManual ? (
        <ManualLfoForm />
      ) : farms.length === 0 || !selected ? (
        <p className="mb-6 text-sm text-stone-600">
          Add an active farm with a flock before creating an LFO.
        </p>
      ) : (
        <FarmLfoForm key={selected.id} farmId={selected.id} houses={selected.houses} />
      )}

      <div className="mb-3 mt-8">
        <h2 className="text-lg font-bold text-stone-900">Saved LFOs</h2>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          Order/reclaim stay as they were when you saved. Open one to view or edit, or
          save as a new LFO for a fresh snapshot.
        </p>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          Rounds up to nearest 500, adds 2000, then drops any leftover 500
        </p>
        <p className="text-xs leading-snug text-stone-500">
          Reclaim rounds to nearest 500, then drops any leftover 500
        </p>
      </div>

      {savedLfos.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No saved LFOs yet. Save from Quick Calc or a farm.
          </p>
        </Card>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="grid gap-2">
            {savedLfos.map((lfo) => (
              <SavedLfoRow
                key={lfo.id}
                id={lfo.id}
                farmName={lfo.farmName}
                dateLabel={lfo.dateLabel}
                houseSummary={lfo.houseSummary}
                shareInventory={lfo.shareInventory}
              />
            ))}
          </div>
        </ExclusiveSwipeGroup>
      )}
    </div>
  );
}
