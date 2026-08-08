"use client";

import { useState, useTransition } from "react";
import {
  uploadScheduleImportAction,
  type UploadScheduleImportResult,
} from "@/app/actions/schedule-import";
import {
  SCHEDULE_IMPORT_TYPES,
  formatBytes,
  formatUploadedAt,
  scheduleImportTypeLabel,
  type ScheduleImportMeta,
  type ScheduleImportType,
} from "@/lib/schedule-import-types";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export function DashboardScheduleImport({
  imports,
}: {
  imports: ScheduleImportMeta[];
}) {
  const [importType, setImportType] = useState<ScheduleImportType>("placement");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UploadScheduleImportResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const shown = imports.filter((item) => item.importType === importType);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setResult(null);

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
        setResult(res);
        if (res.ok) form.reset();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <Card>
      <p className="text-sm text-stone-600">
        Import Placement, Catch Schedule, or Settlements. Start with a Placement
        file — next you’ll tell us which fields to pull.
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
                setResult(null);
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
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.csv,.xls,.xlsx,.txt,application/pdf,image/*,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800"
            disabled={pending || importType !== "placement"}
          />
          {importType !== "placement" ? (
            <p className="mt-2 text-sm text-stone-500">
              {scheduleImportTypeLabel(importType)} mapping comes next. Upload
              Placement first.
            </p>
          ) : (
            <p className="mt-2 text-sm text-stone-500">
              PDF, photo, or spreadsheet is fine for now.
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending || importType !== "placement"}>
          {pending ? "Uploading…" : "Upload for import"}
        </Button>
      </form>

      {localError ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{localError}</p>
      ) : null}
      {result && !result.ok ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{result.error}</p>
      ) : null}
      {result?.ok ? (
        <p className="mt-3 text-sm font-semibold text-emerald-800">
          Saved {result.example.originalName} ({result.sizeLabel}). Tell me how
          you want the Placement fields mapped next.
        </p>
      ) : null}

      {shown.length > 0 ? (
        <div className="mt-5 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-bold text-stone-900">
            Uploaded {scheduleImportTypeLabel(importType).toLowerCase()}
          </h3>
          <ul className="mt-2 space-y-2">
            {shown.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <a
                  href={`/api/schedule-imports/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                >
                  {item.originalName}
                </a>
                <span className="text-stone-500">
                  {formatBytes(item.sizeBytes)} · {formatUploadedAt(item.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
