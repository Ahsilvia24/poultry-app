"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHouseLoggedTempAction } from "@/app/actions/farms";
import { Button, Input, Label } from "@/components/ui";

export function HouseLogTempButton({
  farmId,
  houseId,
  houseNumber,
  loggedTemp,
}: {
  farmId: string;
  houseId: string;
  houseNumber: number;
  loggedTemp: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(loggedTemp ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setTemp(loggedTemp ?? "");
      setError(null);
    }
  }, [open, loggedTemp]);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("temp", temp);
      const result = await updateHouseLoggedTempAction(farmId, houseId, fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("temp", "");
      const result = await updateHouseLoggedTempAction(farmId, houseId, fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          loggedTemp
            ? "inline-flex min-h-14 min-w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border-[1.5px] border-emerald-800 bg-white px-2.5 py-2 text-center hover:bg-emerald-50"
            : "inline-flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-xl border-[1.5px] border-stone-300 bg-stone-100 px-2.5 py-2 text-center text-xs font-extrabold leading-tight text-stone-900 hover:bg-stone-200"
        }
        aria-label={
          loggedTemp
            ? `Edit temperature for house ${houseNumber}, currently ${loggedTemp} degrees`
            : `Log temperature for house ${houseNumber}`
        }
      >
        {loggedTemp ? (
          <>
            <span className="text-lg font-extrabold leading-tight text-emerald-800">
              {loggedTemp}°
            </span>
            <span className="mt-0.5 text-[10px] font-bold text-stone-500">Temp</span>
          </>
        ) : (
          <>
            Log
            <br />
            Temp
          </>
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`House ${houseNumber} temperature`}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-stone-900">
              House {houseNumber} temperature
            </h2>
            <p className="mt-1 mb-4 text-sm text-stone-600">
              Logged temps fill Current Temp on the Service Report and reset at midnight.
            </p>
            <Label htmlFor={`house-temp-${houseId}`}>Temperature (°F)</Label>
            <Input
              id={`house-temp-${houseId}`}
              inputMode="decimal"
              placeholder="e.g. 78"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              autoFocus
            />
            {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" onClick={save} disabled={pending}>
                Save temperature
              </Button>
              {temp.trim() || loggedTemp ? (
                <Button type="button" variant="secondary" onClick={clear} disabled={pending}>
                  Clear temperature
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={close} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
