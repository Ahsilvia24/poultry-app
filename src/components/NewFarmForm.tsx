"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createFarmAction } from "@/app/actions/farms";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { Button, Card, PageHeader } from "@/components/ui";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { cn } from "@/lib/utils";

const labelClass = "min-w-0 flex-1 text-[15px] font-semibold leading-none text-stone-800";
const valueTextClass =
  "w-full border-0 bg-transparent p-0 text-right text-[15px] font-semibold leading-none text-stone-900 outline-none focus:ring-0";
const valueChipClass = "flex h-9 items-center justify-end rounded-lg bg-stone-200 px-2.5";

function placeCaretAtEnd(el: HTMLInputElement) {
  const move = () => {
    const n = el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* iOS may ignore selection on some input types */
    }
  };
  move();
  requestAnimationFrame(move);
  window.setTimeout(move, 0);
  window.setTimeout(move, 50);
}

function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ValueChip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(valueChipClass, className)}>{children}</div>;
}

function ChipInput({
  id,
  name,
  defaultValue,
  required,
  inputMode = "text",
  autoComplete,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  inputMode?: "text" | "numeric";
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete ?? "off"}
      defaultValue={defaultValue}
      required={required}
      onFocus={(event) => placeCaretAtEnd(event.currentTarget)}
      className={valueTextClass}
    />
  );
}

export function NewFarmForm() {
  const { enabled, queue } = useReplicaWrite();
  const nav = useOfflineNav();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSave(formData: FormData) {
    setError(null);
    start(async () => {
      if (enabled) {
        const id = localRecordId();
        queue(
          formWrite("createFarm", {
            id,
            farmId: id,
            ...formDataToParts(formData),
          }),
        );
        nav?.navigate(`/farms/${id}`);
        return;
      }
      const result = await createFarmAction(formData);
      if (result && "error" in result && result.error) setError(result.error);
    });
  }

  return (
    <div>
      <PageHeader
        title="New Farm"
        actions={
          <ReplicaLink href="/farms">
            <Button variant="secondary" compact>
              Cancel
            </Button>
          </ReplicaLink>
        }
      />

      <Card className="max-w-2xl">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <form action={onSave} className="space-y-1">
          <FieldRow label="Farm name" htmlFor="farmName">
            <ValueChip className="min-w-[9.5rem] max-w-[14rem] flex-1">
              <ChipInput id="farmName" name="farmName" required autoComplete="off" />
            </ValueChip>
          </FieldRow>
          <FieldRow label="Number of houses" htmlFor="numberOfHouses">
            <ValueChip className="w-[4.75rem]">
              <ChipInput
                id="numberOfHouses"
                name="numberOfHouses"
                defaultValue="4"
                inputMode="numeric"
              />
            </ValueChip>
          </FieldRow>
          <FieldRow label="Number of generators" htmlFor="numberOfGenerators">
            <ValueChip className="w-[4.75rem]">
              <ChipInput
                id="numberOfGenerators"
                name="numberOfGenerators"
                defaultValue=""
                inputMode="numeric"
              />
            </ValueChip>
          </FieldRow>
          <FieldRow label="Grower name" htmlFor="growerName">
            <ValueChip className="min-w-[9.5rem] max-w-[14rem] flex-1">
              <ChipInput id="growerName" name="growerName" autoComplete="name" />
            </ValueChip>
          </FieldRow>
          <div className="flex justify-end pt-3">
            <Button type="submit" disabled={pending} compact>
              {pending ? "Creating…" : "Create farm"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
