"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFlockNumberAction } from "@/app/actions/farms";
import { Button, Input, Label } from "@/components/ui";

type FlockOption = { id: string; flockNumber: string; ageDays: number };

export function EditFlockNumberButton({ flocks }: { flocks: FlockOption[] }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<FlockOption | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (flocks.length === 0) return null;

  function beginEdit(flock: FlockOption) {
    setPickerOpen(false);
    setEditing(flock);
    setDraft(flock.flockNumber);
    setError(null);
  }

  function onPencil() {
    if (flocks.length === 1) {
      beginEdit(flocks[0]!);
      return;
    }
    setPickerOpen((v) => !v);
  }

  function save() {
    if (!editing) return;
    setError(null);
    start(async () => {
      const result = await updateFlockNumberAction(editing.id, draft);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onPencil}
        aria-label="Edit flock ID"
        title="Edit flock ID"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      {pickerOpen ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold text-stone-500">Edit flock ID</p>
          {flocks.map((flock) => (
            <button
              key={flock.id}
              type="button"
              onClick={() => beginEdit(flock)}
              className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              {flock.flockNumber} ({flock.ageDays}d)
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-4 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">Edit flock ID</h3>
            <p className="mt-1 text-sm text-stone-500">
              {editing.flockNumber} ({editing.ageDays}d)
            </p>
            {error ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            ) : null}
            <div className="mt-3">
              <Label htmlFor="edit-flock-number">Flock number</Label>
              <Input
                id="edit-flock-number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoCapitalize="characters"
                autoFocus
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" disabled={pending} onClick={save} className="flex-1">
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setEditing(null)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
