"use client";

import { useState, useTransition } from "react";
import {
  importMobileBackupAction,
  type ImportMobileBackupResult,
} from "@/app/actions/import-backup";
import { Button, Card } from "@/components/ui";

export function ImportPhoneBackupForm() {
  const [pending, startTransition] = useTransition();
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [result, setResult] = useState<ImportMobileBackupResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setResult(null);

    const form = e.currentTarget;
    const input = form.elements.namedItem("backup") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setLocalError("Choose a .json backup file exported from the phone.");
      return;
    }

    startTransition(async () => {
      try {
        const text = await file.text();
        const res = await importMobileBackupAction(text, { replaceExisting });
        setResult(res);
        if (res.ok) form.reset();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <Card className="mt-6 max-w-2xl">
      <h2 className="font-bold text-stone-900">Import phone backup</h2>
      <p className="mt-2 text-sm text-stone-600 leading-relaxed">
        Upload a JSON file exported from the PoultryTech mobile app (Dashboard or Tools →
        Export data). Farms and related records are created under your web account.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="backup"
            className="mb-1 block text-sm font-semibold text-stone-700"
          >
            Backup file
          </label>
          <input
            id="backup"
            name="backup"
            type="file"
            accept="application/json,.json"
            className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            disabled={pending}
          />
        </div>

        <label className="flex items-start gap-2 text-sm font-semibold text-stone-700">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(ev) => setReplaceExisting(ev.target.checked)}
            className="mt-0.5 h-5 w-5"
            disabled={pending}
          />
          <span>
            Replace all existing farm data on this web account before importing
            <span className="block font-normal text-stone-500 mt-0.5">
              Permanent. Use this if you want the web app to match the phone.
            </span>
          </span>
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import backup"}
        </Button>
      </form>

      {localError ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{localError}</p>
      ) : null}

      {result && !result.ok ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{result.error}</p>
      ) : null}

      {result?.ok ? (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <p className="font-bold">Import complete</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>Farms: {result.imported.farms}</li>
            <li>Houses: {result.imported.houses}</li>
            <li>Flocks: {result.imported.flocks}</li>
            <li>House flocks: {result.imported.houseFlocks}</li>
            <li>Mortality days: {result.imported.mortality}</li>
            <li>Visits: {result.imported.visits}</li>
            <li>LFOs: {result.imported.lastFeedOrders}</li>
            <li>Follow-ups: {result.imported.followUps}</li>
            <li>Issues: {result.imported.issues}</li>
            <li>Litter events: {result.imported.litterEvents}</li>
            <li>Feed deliveries: {result.imported.feedDeliveries}</li>
          </ul>
          {result.warnings.length > 0 ? (
            <div className="mt-3">
              <p className="font-semibold">Notes</p>
              <ul className="mt-1 list-disc pl-5 text-emerald-900/80">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.skipped.length > 0 ? (
            <div className="mt-3">
              <p className="font-semibold">Skipped ({result.skipped.length})</p>
              <ul className="mt-1 list-disc pl-5 text-emerald-900/80">
                {result.skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
