"use client";

import { useMemo, useState, useTransition } from "react";
import {
  uploadScheduleImportAction,
  type UploadScheduleImportResult,
} from "@/app/actions/schedule-import";
import {
  applyPlacementImportAction,
  previewPlacementImportAction,
  type PlacementApplyResult,
  type PlacementPreviewResult,
  type PlacementSelection,
} from "@/app/actions/placement-import";
import {
  applyCatchImportAction,
  previewCatchImportAction,
  type CatchApplyResult,
  type CatchPreviewResult,
  type CatchSelection,
} from "@/app/actions/catch-import";
import {
  SCHEDULE_IMPORT_TYPES,
  formatBytes,
  formatUploadedAt,
  scheduleImportTypeLabel,
  type ScheduleImportMeta,
  type ScheduleImportType,
} from "@/lib/schedule-import-types";
import type { PlacementFarmPreview } from "@/lib/placement-import/types";
import type { CatchFarmPreview } from "@/lib/catch-import/types";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

type PreviewState =
  | ({ kind: "placement" } & Extract<PlacementPreviewResult, { ok: true }>)
  | ({ kind: "catch" } & Extract<CatchPreviewResult, { ok: true }>);

type ApplyState =
  | ({ kind: "placement" } & PlacementApplyResult)
  | ({ kind: "catch" } & CatchApplyResult);

function isLiveImportType(type: ScheduleImportType) {
  return type === "placement" || type === "catch";
}

export function DashboardScheduleImport({
  imports,
}: {
  imports: ScheduleImportMeta[];
}) {
  const [importType, setImportType] = useState<ScheduleImportType>("placement");
  const [pending, startTransition] = useTransition();
  const [uploadResult, setUploadResult] = useState<UploadScheduleImportResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<Record<string, boolean>>({});
  const [onlyMyFarms, setOnlyMyFarms] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyState | null>(null);

  const shownUploads = imports.filter((item) => item.importType === importType);
  const live = isLiveImportType(importType);

  const farms = preview?.farms ?? [];
  const myFarmKeys = useMemo(
    () => new Set(farms.filter((f) => f.isMyFarm).map((f) => f.key)),
    [farms],
  );

  function applyOnlyMyFarms(
    checked: boolean,
    list: Array<PlacementFarmPreview | CatchFarmPreview>,
  ) {
    setOnlyMyFarms(checked);
    if (!checked) return;
    const next: Record<string, boolean> = {};
    for (const farm of list) next[farm.key] = farm.isMyFarm;
    setSelected(next);
  }

  function loadPreview(importId: string, type: ScheduleImportType = importType) {
    startTransition(async () => {
      setLocalError(null);
      setApplyResult(null);

      if (type === "catch") {
        const res = await previewCatchImportAction(importId);
        if (!res.ok) {
          setLocalError(res.error);
          setPreview(null);
          return;
        }
        setPreview({ kind: "catch", ...res });
        const nextSelected: Record<string, boolean> = {};
        for (const farm of res.farms) nextSelected[farm.key] = farm.isMyFarm;
        setSelected(nextSelected);
        setRename({});
        setOnlyMyFarms(true);
        return;
      }

      const res = await previewPlacementImportAction(importId);
      if (!res.ok) {
        setLocalError(res.error);
        setPreview(null);
        return;
      }
      setPreview({ kind: "placement", ...res });
      const nextSelected: Record<string, boolean> = {};
      const nextRename: Record<string, boolean> = {};
      for (const farm of res.farms) {
        nextSelected[farm.key] = farm.isMyFarm;
        nextRename[farm.key] = false;
      }
      setSelected(nextSelected);
      setRename(nextRename);
      setOnlyMyFarms(true);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setUploadResult(null);
    setApplyResult(null);
    setPreview(null);

    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    if (!input?.files?.[0]) {
      setLocalError("Choose a file to import.");
      return;
    }

    const formData = new FormData(form);
    formData.set("importType", importType);

    startTransition(async () => {
      try {
        const res = await uploadScheduleImportAction(formData);
        setUploadResult(res);
        if (!res.ok) return;
        form.reset();
        if (isLiveImportType(importType)) {
          loadPreview(res.example.id, importType);
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function onImportSelected() {
    if (!preview) return;

    startTransition(async () => {
      setLocalError(null);
      if (preview.kind === "catch") {
        const selections: CatchSelection[] = preview.farms.map((farm) => ({
          key: farm.key,
          selected: Boolean(selected[farm.key]),
        }));
        const res = await applyCatchImportAction({
          importId: preview.importId,
          selections,
        });
        setApplyResult({ kind: "catch", ...res });
        if (res.ok) {
          setPreview(null);
          setOnlyMyFarms(false);
        }
        return;
      }

      const selections: PlacementSelection[] = preview.farms.map((farm) => ({
        key: farm.key,
        selected: Boolean(selected[farm.key]),
        renameToImportedName: Boolean(rename[farm.key]),
      }));
      const res = await applyPlacementImportAction({
        importId: preview.importId,
        selections,
      });
      setApplyResult({ kind: "placement", ...res });
      if (res.ok) {
        setPreview(null);
        setOnlyMyFarms(false);
      }
    });
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Card>
      <p className="text-sm text-stone-600">
        Import Placement, Catch Schedule, or Settlements. Catch Schedule reads only farm name,
        house number, and catch/kill date, then updates matching farms.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {SCHEDULE_IMPORT_TYPES.map((type) => {
          const active = importType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setImportType(type.id);
                setLocalError(null);
                setUploadResult(null);
                setPreview(null);
                setApplyResult(null);
              }}
              className={cn(
                "min-h-10 rounded-lg px-3 text-sm font-semibold transition",
                active
                  ? "bg-emerald-700 text-white"
                  : "bg-stone-100 text-stone-800 hover:bg-stone-200",
              )}
            >
              {type.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="scheduleImportFile"
            className="mb-1 block text-sm font-semibold text-stone-700"
          >
            {scheduleImportTypeLabel(importType)} file
          </label>
          <input
            id="scheduleImportFile"
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,.txt,application/pdf,image/*,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800"
            disabled={pending || !live}
          />
          {importType === "settlement" ? (
            <p className="mt-2 text-sm text-stone-500">
              Settlements mapping comes next. Use Placement or Catch Schedule.
            </p>
          ) : importType === "catch" ? (
            <p className="mt-2 text-sm text-stone-500">
              Fort Smith / Heavener Catch Schedule PDF or spreadsheet. Uses farm name, house, and
              kill/catch date only.
            </p>
          ) : (
            <p className="mt-2 text-sm text-stone-500">
              Weekly Chick Placement PDF or spreadsheet.
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending || !live}>
          {pending ? "Working…" : "Upload & read"}
        </Button>
      </form>

      {localError ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{localError}</p>
      ) : null}
      {uploadResult && !uploadResult.ok ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{uploadResult.error}</p>
      ) : null}
      {uploadResult?.ok && !preview ? (
        <p className="mt-3 text-sm font-semibold text-emerald-800">
          Saved {uploadResult.example.originalName} ({uploadResult.sizeLabel}).
        </p>
      ) : null}

      {preview ? (
        <div className="mt-5 border-t border-stone-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {preview.kind === "catch" ? "Choose farms to update" : "Choose farms to import"}
              </h3>
              <p className="text-sm text-stone-500">
                {preview.totalRows} rows · {preview.farms.length} farms in file
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={onlyMyFarms}
                onChange={(e) => applyOnlyMyFarms(e.target.checked, preview.farms)}
              />
              Only my farms
            </label>
          </div>

          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {preview.farms.map((farm) => {
              const checked = Boolean(selected[farm.key]);
              const catchFarm = preview.kind === "catch" ? (farm as CatchFarmPreview) : null;
              const placementFarm =
                preview.kind === "placement" ? (farm as PlacementFarmPreview) : null;
              return (
                <li
                  key={farm.key}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={checked}
                      onChange={(e) => {
                        const value = e.target.checked;
                        setSelected((prev) => ({ ...prev, [farm.key]: value }));
                        if (onlyMyFarms && value && !myFarmKeys.has(farm.key)) {
                          setOnlyMyFarms(false);
                        }
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-stone-900">
                        {farm.farmName}
                        {catchFarm?.farmCode || placementFarm?.farmCode ? (
                          <span className="ml-2 font-medium text-stone-500">
                            {catchFarm?.farmCode ?? placementFarm?.farmCode}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-stone-500">
                        {farm.rowCount} rows · houses {farm.houseNumbers.join(", ")}
                        {catchFarm
                          ? ` · catch ${catchFarm.catchDates.join(", ")}`
                          : placementFarm
                            ? ` · flocks ${placementFarm.flockIds.join(", ")}`
                            : null}
                      </span>
                      {farm.isMyFarm ? (
                        <span className="mt-1 inline-block text-xs font-semibold text-emerald-800">
                          Matches your farm
                          {farm.match.farm ? `: ${farm.match.farm.farmName}` : ""}
                          {farm.match.kind === "fuzzy" ? " (similar name)" : ""}
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-xs font-semibold text-amber-800">
                          {preview.kind === "catch"
                            ? "No matching farm — will be skipped"
                            : "New farm will be created"}
                        </span>
                      )}
                    </span>
                  </label>

                  {preview.kind === "placement" &&
                  checked &&
                  farm.match.nameDiffers &&
                  farm.match.farm ? (
                    <label className="mt-2 flex items-start gap-2 border-t border-stone-200 pt-2 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={Boolean(rename[farm.key])}
                        onChange={(e) =>
                          setRename((prev) => ({ ...prev, [farm.key]: e.target.checked }))
                        }
                      />
                      <span>
                        Update farm name from{" "}
                        <span className="font-semibold">{farm.match.farm.farmName}</span> to{" "}
                        <span className="font-semibold">{farm.farmName}</span>? Keeps grower,
                        phone, houses, and other saved info.
                      </span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={pending || selectedCount === 0} onClick={onImportSelected}>
              {pending
                ? preview.kind === "catch"
                  ? "Updating…"
                  : "Importing…"
                : preview.kind === "catch"
                  ? `Update ${selectedCount} farm${selectedCount === 1 ? "" : "s"}`
                  : `Import ${selectedCount} farm${selectedCount === 1 ? "" : "s"}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setOnlyMyFarms(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {applyResult?.ok && applyResult.kind === "placement" ? (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <p className="font-bold">Placement import complete</p>
          <ul className="mt-2 space-y-1">
            <li>Farms created: {applyResult.createdFarms}</li>
            <li>Farm names updated: {applyResult.updatedNames}</li>
            <li>Houses created: {applyResult.createdHouses}</li>
            <li>Flocks created: {applyResult.createdFlocks}</li>
          </ul>
          {applyResult.warnings.length > 0 ? (
            <div className="mt-2">
              <p className="font-semibold">Notes</p>
              <ul className="mt-1 list-disc pl-5">
                {applyResult.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {applyResult?.ok && applyResult.kind === "catch" ? (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <p className="font-bold">Catch dates updated</p>
          <ul className="mt-2 space-y-1">
            <li>Houses updated: {applyResult.updatedHouses}</li>
            <li>Flocks synced: {applyResult.updatedFlocks}</li>
            <li>Farms skipped: {applyResult.skippedFarms}</li>
          </ul>
          {applyResult.warnings.length > 0 ? (
            <div className="mt-2">
              <p className="font-semibold">Notes</p>
              <ul className="mt-1 list-disc pl-5">
                {applyResult.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {applyResult && !applyResult.ok ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{applyResult.error}</p>
      ) : null}

      {shownUploads.length > 0 ? (
        <div className="mt-5 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-bold text-stone-900">
            Uploaded {scheduleImportTypeLabel(importType).toLowerCase()}
          </h3>
          <ul className="mt-2 space-y-2">
            {shownUploads.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <a
                  href={`/api/schedule-imports/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                >
                  {item.originalName}
                </a>
                <span className="flex items-center gap-3 text-stone-500">
                  {formatBytes(item.sizeBytes)} · {formatUploadedAt(item.uploadedAt)}
                  {isLiveImportType(importType) ? (
                    <button
                      type="button"
                      className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                      onClick={() => loadPreview(item.id, importType)}
                      disabled={pending}
                    >
                      Review farms
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
