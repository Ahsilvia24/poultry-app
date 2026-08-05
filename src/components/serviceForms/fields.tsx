"use client";

import { cn } from "@/lib/utils";
import { LIGHT_TIME_OPTIONS } from "@/lib/serviceForms/format";
import type { YesNo } from "@/lib/serviceForms/types";

export function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="mb-2 mt-4 text-[15px] font-extrabold text-stone-900 first:mt-0">
      {title}
    </h3>
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
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 py-2">
      <span className="flex-1 text-sm font-semibold text-stone-800">{label}</span>
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
                  : "bg-stone-100 text-stone-800",
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

/** Multi-select chip row. Tap again to clear. */
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
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 py-2">
      <span className="flex-1 text-sm font-semibold text-stone-800">{label}</span>
      <div className="flex flex-wrap justify-end gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (active) onChange(value.filter((v) => v !== opt.value));
                else onChange([...value, opt.value]);
              }}
              className={cn(
                "min-w-12 rounded-lg px-2.5 py-2 text-xs font-extrabold",
                active ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-800",
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

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "time";
  multiline?: boolean;
  /** Optional wrapper class (e.g. narrow time fields). */
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5", className)}>
      <label className="mb-1 block text-[13px] font-bold text-stone-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base font-semibold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base font-semibold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
      )}
    </div>
  );
}

export function PairFields({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

/** Full-width half-hour time select — fills PairFields columns evenly. */
export function TimeSelectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const known = !value || LIGHT_TIME_OPTIONS.some((o) => o.value === value);
  return (
    <div className="mb-2.5 min-w-0">
      <label className="mb-1 block text-[13px] font-bold text-stone-500">{label}</label>
      <select
        value={value === "24/7" ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2.5 text-base font-semibold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      >
        <option value="">Select time</option>
        {!known && value !== "24/7" ? (
          <option value={value}>{value}</option>
        ) : null}
        {LIGHT_TIME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
    <div className="min-w-[4.5rem] flex-1 basis-[30%]">
      <label className="mb-1 block text-xs font-extrabold text-stone-500">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-10 w-full rounded-[10px] border border-stone-300 bg-white px-2.5 text-center text-base font-bold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      />
    </div>
  );
}

/** Dense H1 / H2 / … value grid. */
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

/** Heat/Cool on row 1, Stage 1–3 on row 2. */
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
      <p className="mb-1 mt-1 font-bold text-stone-800">Backup settings</p>
      <div className="flex gap-2">
        <CompactCell
          label="Heat"
          value={heat}
          onChange={(backupHeat) => onChange({ backupHeat })}
        />
        <CompactCell
          label="Cool"
          value={cool}
          onChange={(backupCool) => onChange({ backupCool })}
        />
      </div>
      <div className="flex gap-2">
        <CompactCell
          label="Stage 1"
          value={stage1}
          onChange={(backupStage1) => onChange({ backupStage1 })}
        />
        <CompactCell
          label="Stage 2"
          value={stage2}
          onChange={(backupStage2) => onChange({ backupStage2 })}
        />
        <CompactCell
          label="Stage 3"
          value={stage3}
          onChange={(backupStage3) => onChange({ backupStage3 })}
        />
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
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2.5 text-lg font-extrabold text-stone-900">Comments</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add comments…"
        rows={4}
        className="min-h-[110px] w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base font-medium text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      />
    </div>
  );
}

export function ChoiceToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-2.5 flex gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-[10px] py-3 text-sm font-extrabold",
              active ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-800",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
