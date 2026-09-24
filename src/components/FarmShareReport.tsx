"use client";

import {
  SettingsValueChip,
  settingsValueTextClass,
} from "@/components/SettingsLayout";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { shareFarmSharePdf } from "@/lib/reports/farm-share-pdf";
import {
  ALL_FARM_SHARE_FIELDS,
  FARM_SHARE_FIELDS,
  farmShareCheckboxLabel,
  firstShareFarmId,
  selectFarmShare,
  shareFarms,
  toggleShareField,
  type FarmShareFieldKey,
} from "@/lib/reports/farm-share";
import type { OfflineSnapshot } from "@/lib/offline/types";

export function FarmShareReport({
  snapshot,
  farmId,
  fields,
  onFarmChange,
  onFieldsChange,
}: {
  snapshot: OfflineSnapshot;
  farmId: string;
  fields: FarmShareFieldKey[];
  onFarmChange: (farmId: string) => void;
  onFieldsChange: (fields: FarmShareFieldKey[]) => void;
}) {
  const farms = shareFarms(snapshot);
  const selectedFarmId = farmId || firstShareFarmId(snapshot);
  const model = selectedFarmId ? selectFarmShare(snapshot, selectedFarmId) : null;
  const timing = model?.timing;
  const selected = new Set(fields);
  const allOn = ALL_FARM_SHARE_FIELDS.every((key) => selected.has(key));
  const canShare = Boolean(model && selected.size > 0);

  function sharePdf() {
    if (!model || selected.size === 0) return;
    void shareFarmSharePdf(model, fields);
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <SettingsValueChip className="min-w-0 flex-1">
          <select
            id="data-farm"
            value={selectedFarmId}
            onChange={(event) => onFarmChange(event.target.value)}
            className={cn(settingsValueTextClass, "text-left")}
          >
            {farms.length === 0 ? <option value="">No farms</option> : null}
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.farmName}
              </option>
            ))}
          </select>
        </SettingsValueChip>
        <Button type="button" compact className="shrink-0" disabled={!canShare} onClick={sharePdf}>
          Share PDF
        </Button>
      </div>

      {selectedFarmId ? (
        <div className="mt-4">
          <button
            type="button"
            className="text-sm font-bold text-stone-800 underline"
            onClick={() => onFieldsChange(allOn ? [] : [...ALL_FARM_SHARE_FIELDS])}
          >
            {allOn ? "Unselect all" : "Select all"}
          </button>
          <ul className="mt-3 space-y-2.5">
            {FARM_SHARE_FIELDS.map((field) => (
              <li key={field.key}>
                <label className="flex items-center gap-2.5 text-[15px] font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                    checked={selected.has(field.key)}
                    onChange={(event) =>
                      onFieldsChange(toggleShareField(fields, field.key, event.target.checked))
                    }
                  />
                  {timing ? farmShareCheckboxLabel(field.key, timing) : field.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-500">Select a farm to choose what to share.</p>
      )}
    </Card>
  );
}
