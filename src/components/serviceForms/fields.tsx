"use client";

import type { ReactNode } from "react";
import { Input, Textarea } from "@/components/ui";
import { DateKeyField } from "@/components/DateKeyField";
import { TimeKeyField } from "@/components/TimeKeyField";
import { cn } from "@/lib/utils";
import type { YesNo } from "@/lib/serviceForms/types";

export function SectionTitle({ title }: { title: string }) {
  return <h3 className="mb-2 mt-4 text-[15px] font-extrabold text-stone-900">{title}</h3>;
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 border-b border-stone-200 py-2 text-left"
    >
      <span
        className={cn(
          "flex h-[22px] w-[22px] items-center justify-center rounded-md border-2 text-xs font-extrabold",
          checked
            ? "border-emerald-800 bg-emerald-700 text-white"
            : "border-stone-300 bg-white text-transparent",
        )}
      >
        ✓
      </span>
      <span className="flex-1 text-sm font-semibold text-stone-900">{label}</span>
    </button>
  );
}

export function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-stone-200 py-2">
      <p className="flex-1 text-sm font-semibold text-stone-900">{label}</p>
      <div className="flex gap-1.5">
        {(["yes", "no"] as const).map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "min-w-12 rounded-lg px-2.5 py-2 text-xs font-extrabold",
                active
                  ? opt === "yes"
                    ? "bg-emerald-700 text-white"
                    : "bg-orange-800 text-white"
                  : "bg-stone-100 text-stone-900",
              )}
            >
              {opt === "yes" ? "YES" : "NO"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MultiToggleField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-stone-200 py-2">
      <p className="flex-1 text-sm font-semibold text-stone-900">{label}</p>
      <div className="flex flex-wrap justify-end gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onChange(
                  active ? value.filter((v) => v !== opt.value) : [...value, opt.value],
                )
              }
              className={cn(
                "min-w-12 rounded-lg px-2.5 py-2 text-xs font-extrabold",
                active ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-900",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (next: T) => void;
}) {
  return (
    <div className="my-2 flex gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-[10px] py-3 text-sm font-extrabold",
              active ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-900",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
  readOnly?: boolean;
}) {
  return (
    <div className="mb-2.5">
      <label className="mb-1 block text-[13px] font-bold text-stone-500">{label}</label>
      <Input
        compact
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className={readOnly ? "bg-stone-100" : undefined}
      />
    </div>
  );
}

export function PairFields({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <label className="mb-1 block text-[13px] font-bold text-stone-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-base font-semibold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      >
        {options.map((opt) => (
          <option key={opt.value || "blank"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TimeField({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const fieldId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="mb-3 mt-2">
      <label className="mb-1 block text-[13px] font-bold text-stone-500">{label}</label>
      {value === "24/7" ? (
        <Input compact readOnly value="24/7" />
      ) : (
        <TimeKeyField id={fieldId} name={fieldId} label={label} value={value} onChange={onChange} />
      )}
    </div>
  );
}

export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <label className="mb-1 block text-[13px] font-bold text-stone-500">{label}</label>
      <DateKeyField id={id} name={id} label={label} value={value} onChange={onChange} />
    </div>
  );
}

function CompactCell({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="min-w-[72px] flex-1 basis-[30%]">
      <p className="mb-1 text-xs font-extrabold text-stone-500">{label}</p>
      <Input
        compact
        value={value}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        className="text-center"
      />
    </div>
  );
}

export function CompactHouseValueGrid({
  houses,
  getValue,
  onChange,
  placeholder,
}: {
  houses: Array<{ houseNumber: number }>;
  getValue: (houseNumber: number) => string;
  onChange: (houseNumber: number, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {houses.map((h) => (
        <CompactCell
          key={h.houseNumber}
          label={`H${h.houseNumber}`}
          value={getValue(h.houseNumber)}
          onChange={(v) => onChange(h.houseNumber, v)}
          placeholder={placeholder}
        />
      ))}
    </div>
  );
}

export function CompactBackupSettings({
  heat,
  cool,
  stage1,
  stage2,
  stage3,
  onChange,
}: {
  heat: string;
  cool: string;
  stage1: string;
  stage2: string;
  stage3: string;
  onChange: (patch: {
    backupHeat?: string;
    backupCool?: string;
    backupStage1?: string;
    backupStage2?: string;
    backupStage3?: string;
  }) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="mt-1 font-bold text-stone-900">Backup settings</p>
      <div className="flex gap-2">
        <CompactCell label="Heat" value={heat} onChange={(backupHeat) => onChange({ backupHeat })} />
        <CompactCell label="Cool" value={cool} onChange={(backupCool) => onChange({ backupCool })} />
      </div>
      <div className="flex gap-2">
        <CompactCell label="Stage 1" value={stage1} onChange={(backupStage1) => onChange({ backupStage1 })} />
        <CompactCell label="Stage 2" value={stage2} onChange={(backupStage2) => onChange({ backupStage2 })} />
        <CompactCell label="Stage 3" value={stage3} onChange={(backupStage3) => onChange({ backupStage3 })} />
      </div>
    </div>
  );
}

export function CommentsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
      <p className="mb-2.5 text-lg font-extrabold text-stone-900">Comments</p>
      <Textarea
        value={value}
        placeholder="Add comments…"
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[110px]"
      />
    </div>
  );
}
