"use client";

import { useState, useTransition } from "react";
import {
  uploadSettlementExampleAction,
  type UploadSettlementExampleResult,
} from "@/app/actions/settlement-upload";
import {
  formatBytes,
  formatUploadedAt,
  type SettlementExampleMeta,
} from "@/lib/settlement-example-types";
import { Button, Card } from "@/components/ui";

export function SettlementExampleUpload({
  examples,
}: {
  examples: SettlementExampleMeta[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UploadSettlementExampleResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setResult(null);

    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    if (!input?.files?.[0]) {
      setLocalError("Choose a settlement example file to upload.");
      return;
    }

    const formData = new FormData(form);
    startTransition(async () => {
      try {
        const res = await uploadSettlementExampleAction(formData);
        setResult(res);
        if (res.ok) form.reset();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <Card className="mb-6">
      <h2 className="text-base font-bold text-stone-900">Upload settlement example</h2>
      <p className="mt-1 text-sm text-stone-600">
        Upload a sample settlement sheet (PDF, photo, or spreadsheet). We’ll use it to
        build out this page.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="settlementExample"
            className="mb-1 block text-sm font-semibold text-stone-700"
          >
            Example file
          </label>
          <input
            id="settlementExample"
            name="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.tif,.tiff,.csv,.xls,.xlsx,.doc,.docx,.txt,application/pdf,image/*"
            className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800"
            disabled={pending}
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload example"}
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
          Uploaded {result.example.originalName} ({result.sizeLabel}).
        </p>
      ) : null}

      {examples.length > 0 ? (
        <div className="mt-5 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-bold text-stone-900">Uploaded examples</h3>
          <ul className="mt-2 space-y-2">
            {examples.map((ex) => (
              <li
                key={ex.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <a
                  href={`/api/settlement-examples/${ex.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                >
                  {ex.originalName}
                </a>
                <span className="text-stone-500">
                  {formatBytes(ex.sizeBytes)} · {formatUploadedAt(ex.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
