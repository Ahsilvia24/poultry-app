"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  createGeneratorLogAction,
  deleteGeneratorLogAction,
  updateGeneratorLogAction,
} from "@/app/actions/ops";
import { Button, Card, Input, Label } from "@/components/ui";
import { ExclusiveSwipeGroup, useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";
import {
  detectGeneratorHourSwap,
  formatGeneratorChartsCopy,
  formatGeneratorHours,
  hoursDelta,
  GENERATOR_FIELD_DEFS,
  MAX_GENERATOR_HOUR_LOGS,
  type GenHourKey,
  type GeneratorDeltas,
  type GeneratorHourSwapSuggestion,
  type GeneratorHours,
} from "@/lib/generator/format";

export type GeneratorLogRow = {
  id: string;
  logDate: string;
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

const MAX_GENERATOR_LOGS_DISPLAY = MAX_GENERATOR_HOUR_LOGS;

type ChartRow = {
  id: string;
  dateLabel: string;
  hours: number;
  exercised: number | null;
};

function generatorsHashActive() {
  return typeof window !== "undefined" && window.location.hash === "#generators";
}

function dateLabelFromKey(logDate: string) {
  return format(new Date(logDate + "T12:00:00"), "M-d-yyyy");
}

function hoursOrEmpty(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyLogButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded p-1 text-emerald-800 hover:bg-emerald-50"
      aria-label={copied ? "Copied" : "Copy generator log"}
      title={copied ? "Copied" : "Copy generator log"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
    </button>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0 1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function isActionTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button");
}

function SwipeDeleteRow({
  rowId,
  deleteLabel,
  onDelete,
  children,
}: {
  rowId: string;
  deleteLabel: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef<number | null>(null);
  const actionWidth = 72;
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(rowId);

  useEffect(() => {
    if (!isOpenOwner) setSwipeX(0);
  }, [isOpenOwner]);

  function begin(x: number) {
    startX.current = x;
  }

  function move(x: number) {
    if (startX.current == null) return;
    setSwipeX(Math.max(-actionWidth, Math.min(0, x - startX.current)));
  }

  function end() {
    if (startX.current == null) {
      setSwipeX(0);
      return;
    }
    if (swipeX <= -40) {
      setSwipeX(-actionWidth);
      requestOpen();
    } else {
      setSwipeX(0);
      requestClose();
    }
    startX.current = null;
  }

  function cancel() {
    startX.current = null;
    setSwipeX(0);
  }

  return (
    <div className="relative overflow-hidden">
      {swipeX < -8 ? (
        <div className="absolute inset-y-0 right-0 flex w-[72px] items-stretch">
          <button
            type="button"
            onClick={() => {
              setSwipeX(0);
              onDelete();
            }}
            className="flex w-full items-center justify-center bg-red-700 text-xs font-bold text-white"
            aria-label={deleteLabel}
          >
            Delete
          </button>
        </div>
      ) : null}
      <div
        className="relative bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={(e) => {
          if (isActionTarget(e.target)) return;
          begin(e.touches[0]?.clientX ?? 0);
        }}
        onTouchMove={(e) => {
          const x = e.touches[0]?.clientX;
          if (x != null) move(x);
        }}
        onTouchEnd={end}
        onTouchCancel={cancel}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (isActionTarget(e.target)) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          begin(e.clientX);
        }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={end}
        onPointerCancel={cancel}
      >
        {children}
      </div>
    </div>
  );
}

function GeneratorHoursChart({
  title,
  rows,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: ChartRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => Promise<{ error?: string } | void>;
}) {
  const showActions = onEdit != null && onDelete != null;
  return (
    <div className="text-base leading-snug">
      <h4 className="mb-1 text-base font-bold text-stone-900">{title}</h4>
      <div className="flex gap-3 text-sm leading-none text-stone-500">
        <span className="w-24 shrink-0 font-semibold">Date</span>
        <span className="w-14 shrink-0 font-semibold">Hours</span>
        <span className="w-[4.5rem] shrink-0 font-semibold">Exercised</span>
        {showActions ? <span className="w-7 shrink-0" aria-hidden /> : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-stone-500">None yet</p>
      ) : (
        <ExclusiveSwipeGroup>
        <div>
          {rows.map((row) => {
            const cells = (
              <div className="flex items-center gap-3 py-1 tabular-nums text-stone-800">
                <span className="w-24 shrink-0 whitespace-nowrap font-semibold">{row.dateLabel}</span>
                <span className="w-14 shrink-0 font-semibold">
                  {formatGeneratorHours(row.hours)}
                </span>
                <span className="w-[4.5rem] shrink-0 font-semibold">
                  {formatGeneratorHours(row.exercised)}
                </span>
                {showActions ? (
                  <button
                    type="button"
                    onClick={() => onEdit(row.id)}
                    className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    aria-label="Edit generator entry"
                    title="Edit generator entry"
                  >
                    <GearIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
            if (!showActions) {
              return <div key={row.id}>{cells}</div>;
            }
            return (
              <SwipeDeleteRow
                key={row.id}
                rowId={row.id}
                deleteLabel="Delete generator entry"
                onDelete={() => {
                  void onDelete(row.id);
                }}
              >
                {cells}
              </SwipeDeleteRow>
            );
          })}
        </div>
        </ExclusiveSwipeGroup>
      )}
    </div>
  );
}

function GeneratorLogForm({
  farmId,
  recordId,
  initial,
  previousByGen,
  onlyGen,
  onSuccess,
  onCancel,
}: {
  farmId: string;
  recordId?: string;
  initial?: GeneratorLogRow;
  previousByGen?: Partial<Record<GenHourKey, number | null>>;
  onlyGen?: GenHourKey;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [swap, setSwap] = useState<GeneratorHourSwapSuggestion | null>(null);
  const [logDate, setLogDate] = useState(
    initial?.logDate ?? new Date().toISOString().slice(0, 10),
  );
  const [gen1, setGen1] = useState(hoursOrEmpty(initial?.gen1Hours));
  const [gen2, setGen2] = useState(hoursOrEmpty(initial?.gen2Hours));
  const [gen3, setGen3] = useState(hoursOrEmpty(initial?.gen3Hours));
  const [gen4, setGen4] = useState(hoursOrEmpty(initial?.gen4Hours));

  const fieldState = {
    gen1Hours: [gen1, setGen1] as const,
    gen2Hours: [gen2, setGen2] as const,
    gen3Hours: [gen3, setGen3] as const,
    gen4Hours: [gen4, setGen4] as const,
  };

  const visibleFields = onlyGen
    ? GENERATOR_FIELD_DEFS.filter((field) => field.hourKey === onlyGen)
    : GENERATOR_FIELD_DEFS;

  function enteredHours(): GeneratorHours {
    const parse = (raw: string) => {
      const text = raw.trim();
      if (text === "") return null;
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("Generator hours must be 0 or greater");
      }
      return n;
    };
    return {
      gen1Hours: parse(gen1),
      gen2Hours: parse(gen2),
      gen3Hours: parse(gen3),
      gen4Hours: parse(gen4),
    };
  }

  function previousHours(): GeneratorHours {
    return {
      gen1Hours: previousByGen?.gen1Hours ?? null,
      gen2Hours: previousByGen?.gen2Hours ?? null,
      gen3Hours: previousByGen?.gen3Hours ?? null,
      gen4Hours: previousByGen?.gen4Hours ?? null,
    };
  }

  function appendHours(fd: FormData, hours: GeneratorHours) {
    fd.set("farmId", farmId);
    fd.set("logDate", logDate);
    if (onlyGen) fd.set("onlyGen", onlyGen);
    for (const field of GENERATOR_FIELD_DEFS) {
      const value = hours[field.hourKey];
      fd.set(field.hourKey, value == null ? "" : String(value));
    }
  }

  function submitHours(hours: GeneratorHours, remapAll = false) {
    setError(null);
    const fd = new FormData();
    appendHours(fd, hours);
    if (remapAll) fd.delete("onlyGen");
    start(async () => {
      const result = recordId
        ? await updateGeneratorLogAction(recordId, fd)
        : await createGeneratorLogAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSwap(null);
      onSuccess?.();
    });
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const entered = enteredHours();
          const forDetect = onlyGen
            ? {
                gen1Hours: onlyGen === "gen1Hours" ? entered.gen1Hours : null,
                gen2Hours: onlyGen === "gen2Hours" ? entered.gen2Hours : null,
                gen3Hours: onlyGen === "gen3Hours" ? entered.gen3Hours : null,
                gen4Hours: onlyGen === "gen4Hours" ? entered.gen4Hours : null,
              }
            : entered;
          const found = detectGeneratorHourSwap(previousHours(), forDetect);
          if (found) {
            setSwap(found);
            return;
          }
          submitHours(entered);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save generator log");
        }
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
      {onlyGen ? <input type="hidden" name="onlyGen" value={onlyGen} /> : null}
      <div>
        <Label htmlFor="gen-logDate">Date logged</Label>
        <Input
          id="gen-logDate"
          name="logDate"
          type="date"
          required
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
        />
      </div>
      <div className={`grid gap-3 ${onlyGen ? "grid-cols-1" : "grid-cols-2"}`}>
        {visibleFields.map((field) => {
          const [value, setValue] = fieldState[field.hourKey];
          const delta = hoursDelta(
            value.trim() === "" ? null : Number(value),
            previousByGen?.[field.hourKey] ?? null,
          );
          return (
            <div key={field.hourKey}>
              <Label htmlFor={`gen-${field.hourKey}`}>{field.label} hours</Label>
              <Input
                id={`gen-${field.hourKey}`}
                name={field.hourKey}
                type="text"
                inputMode="decimal"
                value={value}
                placeholder="Optional"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
                className="placeholder:text-stone-400/70"
              />
              <p className="mt-1 text-xs text-stone-500">
                Time exercised: {formatGeneratorHours(delta)}
              </p>
            </div>
          );
        })}
      </div>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {swap ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-stone-800">
          <p className="font-semibold">Hours look swapped</p>
          <p className="mt-1 whitespace-pre-line">{swap.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => submitHours({ ...enteredHours(), ...swap.suggested }, true)}
            >
              Fix and save
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => submitHours(enteredHours())}
            >
              Save as entered
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setSwap(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : recordId
              ? "Save"
              : "Log generators"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function previousReadingForGen(
  logsNewestFirst: GeneratorLogRow[],
  hourKey: GenHourKey,
  opts?: { beforeLogId?: string; beforeDate?: string },
): number | null {
  const beforeDate = opts?.beforeDate;
  const beforeLogId = opts?.beforeLogId;
  let passedEdit = beforeLogId == null;
  for (const log of logsNewestFirst) {
    if (beforeDate != null && log.logDate > beforeDate) continue;
    if (beforeDate != null && log.logDate === beforeDate && beforeLogId == null) continue;
    if (!passedEdit) {
      if (log.id === beforeLogId) {
        passedEdit = true;
      }
      continue;
    }
    if (log[hourKey] != null) return log[hourKey];
  }
  return null;
}

export function FarmGeneratorLogSection({
  farmId,
  logs,
}: {
  farmId: string;
  logs: GeneratorLogRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGen, setEditingGen] = useState<GenHourKey | null>(null);

  const allSorted = useMemo(
    () => [...logs].sort((a, b) => b.logDate.localeCompare(a.logDate) || b.id.localeCompare(a.id)),
    [logs],
  );

  const chartRowsByGen = useMemo(() => {
    return GENERATOR_FIELD_DEFS.map((gen) => {
      const genLogs = allSorted
        .filter((log) => log[gen.hourKey] != null)
        .slice(0, MAX_GENERATOR_LOGS_DISPLAY);
      return {
        ...gen,
        rows: genLogs.map((log, index) => {
          const previous = genLogs[index + 1] ?? null;
          return {
            id: log.id,
            dateLabel: dateLabelFromKey(log.logDate),
            hours: log[gen.hourKey] as number,
            exercised: hoursDelta(log[gen.hourKey], previous?.[gen.hourKey]),
          } satisfies ChartRow;
        }),
      };
    });
  }, [allSorted]);

  const chartsCopyText = useMemo(() => {
    // Match chart windows: up to 10 readings per gen, not 10 shared date rows.
    const byDate = new Map<
      string,
      { dateLabel: string; hours: GeneratorHours; deltas: GeneratorDeltas }
    >();
    for (const gen of chartRowsByGen) {
      for (const row of gen.rows) {
        const log = allSorted.find((l) => l.id === row.id);
        if (!log) continue;
        let entry = byDate.get(log.id);
        if (!entry) {
          entry = {
            dateLabel: row.dateLabel,
            hours: {
              gen1Hours: null,
              gen2Hours: null,
              gen3Hours: null,
              gen4Hours: null,
            },
            deltas: { gen1: null, gen2: null, gen3: null, gen4: null },
          };
          byDate.set(log.id, entry);
        }
        entry.hours[gen.hourKey] = row.hours;
        entry.deltas[gen.deltaKey] = row.exercised;
      }
    }
    return formatGeneratorChartsCopy(
      [...byDate.values()].sort((a, b) => b.dateLabel.localeCompare(a.dateLabel)),
    );
  }, [chartRowsByGen, allSorted]);

  const hasAnyChartRows = chartRowsByGen.some((gen) => gen.rows.length > 0);

  useEffect(() => {
    if (generatorsHashActive()) setOpen(true);

    function onHashChange() {
      if (generatorsHashActive()) {
        setOpen(true);
        setFormOpen(false);
        setEditingId(null);
        setEditingGen(null);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function closeSection() {
    setOpen(false);
    setFormOpen(false);
    setEditingId(null);
    setEditingGen(null);
    if (generatorsHashActive()) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function afterSaved() {
    setFormOpen(false);
    setEditingId(null);
    setEditingGen(null);
    setOpen(true);
    if (!generatorsHashActive()) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#generators`,
      );
    }
  }

  if (!open) return <div id="generators" className="scroll-mt-24" />;

  const editingLog = editingId ? allSorted.find((l) => l.id === editingId) : null;
  const createPreviousByGen: Partial<Record<GenHourKey, number | null>> = {
    gen1Hours: previousReadingForGen(allSorted, "gen1Hours"),
    gen2Hours: previousReadingForGen(allSorted, "gen2Hours"),
    gen3Hours: previousReadingForGen(allSorted, "gen3Hours"),
    gen4Hours: previousReadingForGen(allSorted, "gen4Hours"),
  };
  const editPreviousByGen = editingLog
    ? {
        gen1Hours: previousReadingForGen(allSorted, "gen1Hours", {
          beforeLogId: editingLog.id,
          beforeDate: editingLog.logDate,
        }),
        gen2Hours: previousReadingForGen(allSorted, "gen2Hours", {
          beforeLogId: editingLog.id,
          beforeDate: editingLog.logDate,
        }),
        gen3Hours: previousReadingForGen(allSorted, "gen3Hours", {
          beforeLogId: editingLog.id,
          beforeDate: editingLog.logDate,
        }),
        gen4Hours: previousReadingForGen(allSorted, "gen4Hours", {
          beforeLogId: editingLog.id,
          beforeDate: editingLog.logDate,
        }),
      }
    : undefined;

  return (
    <div id="generators" className="scroll-mt-24">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">Generator Log</h3>
          <div className="flex items-center gap-3">
            {chartsCopyText ? <CopyLogButton text={chartsCopyText} /> : null}
            <button
              type="button"
              onClick={closeSection}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
        </div>

        {editingLog && editingGen ? (
          <GeneratorLogForm
            farmId={farmId}
            recordId={editingLog.id}
            initial={editingLog}
            onlyGen={editingGen}
            previousByGen={editPreviousByGen ?? undefined}
            onSuccess={afterSaved}
            onCancel={() => {
              setEditingId(null);
              setEditingGen(null);
            }}
          />
        ) : null}

        {!hasAnyChartRows ? (
          <p className="mt-3 text-sm text-stone-500">None yet</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {chartRowsByGen
              .filter((gen) => gen.rows.length > 0)
              .map((gen) => (
              <GeneratorHoursChart
                key={gen.key}
                title={gen.label}
                rows={gen.rows}
                onEdit={(id) => {
                  setFormOpen(false);
                  setEditingId(id);
                  setEditingGen(gen.hourKey);
                }}
                onDelete={async (id) => {
                  await deleteGeneratorLogAction(id, gen.hourKey);
                  router.refresh();
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {!formOpen ? (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setEditingGen(null);
              setFormOpen(true);
            }}
            className="text-sm text-emerald-800 hover:underline"
          >
            Log generators
          </button>
        </div>
      ) : (
        <Card className="mt-3">
          <GeneratorLogForm
            farmId={farmId}
            previousByGen={createPreviousByGen}
            onSuccess={afterSaved}
            onCancel={() => setFormOpen(false)}
          />
        </Card>
      )}
    </div>
  );
}
