"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  createGeneratorLogAction,
  deleteGeneratorLogAction,
  updateGeneratorLogAction,
} from "@/app/actions/ops";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { Button, Card, Input, Label } from "@/components/ui";
import {
  formatGeneratorCopyLine,
  formatGeneratorHours,
  generatorDeltas,
  type GeneratorHours,
} from "@/lib/generator/format";

export type GeneratorLogRow = {
  id: string;
  logDate: string;
  gen1Hours: number;
  gen2Hours: number;
  gen3Hours: number;
  gen4Hours: number;
};

const GEN_CHARTS = [
  { key: "gen1", label: "Gen 1", hourKey: "gen1Hours" as const, deltaKey: "gen1" as const },
  { key: "gen2", label: "Gen 2", hourKey: "gen2Hours" as const, deltaKey: "gen2" as const },
  { key: "gen3", label: "Gen 3", hourKey: "gen3Hours" as const, deltaKey: "gen3" as const },
  { key: "gen4", label: "Gen 4", hourKey: "gen4Hours" as const, deltaKey: "gen4" as const },
];

const MAX_GENERATOR_LOGS_DISPLAY = 8;

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

function CopyLogButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-sm font-semibold text-emerald-800 hover:underline"
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
      {copied ? "Copied" : label}
    </button>
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
    <div className="text-xs leading-tight">
      <h4 className="mb-0.5 font-bold text-stone-900">{title}</h4>
      <div className="flex gap-3 text-[11px] leading-none text-stone-500">
        <span className="w-16 shrink-0 font-semibold">Date</span>
        <span className="w-12 shrink-0 font-semibold">Hours</span>
        <span className="w-14 shrink-0 font-semibold">Exercised</span>
        {showActions ? <span className="w-12 shrink-0" aria-hidden /> : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-stone-500">None yet</p>
      ) : (
        <div>
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 py-px leading-none tabular-nums text-stone-800"
            >
              <span className="w-16 shrink-0 font-medium">{row.dateLabel}</span>
              <span className="w-12 shrink-0 font-medium">
                {formatGeneratorHours(row.hours)}
              </span>
              <span className="w-14 shrink-0 font-medium">
                {formatGeneratorHours(row.exercised)}
              </span>
              {showActions ? (
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => onEdit(row.id)}
                    className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    aria-label="Edit generator log"
                    title="Edit generator log"
                  >
                    <svg
                      className="h-3.5 w-3.5"
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
                  <DeleteRecordButton
                    label="Delete generator log"
                    compact
                    onDelete={() => onDelete(row.id)}
                  />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneratorLogForm({
  farmId,
  recordId,
  initial,
  previous,
  onSuccess,
  onCancel,
}: {
  farmId: string;
  recordId?: string;
  initial?: GeneratorLogRow;
  previous?: GeneratorHours | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(
    initial?.logDate ?? new Date().toISOString().slice(0, 10),
  );
  const [gen1, setGen1] = useState(initial ? String(initial.gen1Hours) : "");
  const [gen2, setGen2] = useState(initial ? String(initial.gen2Hours) : "");
  const [gen3, setGen3] = useState(initial ? String(initial.gen3Hours) : "");
  const [gen4, setGen4] = useState(initial ? String(initial.gen4Hours) : "");

  const previewDeltas = useMemo(() => {
    const hours: GeneratorHours = {
      gen1Hours: Number(gen1) || 0,
      gen2Hours: Number(gen2) || 0,
      gen3Hours: Number(gen3) || 0,
      gen4Hours: Number(gen4) || 0,
    };
    return generatorDeltas(hours, previous ?? null);
  }, [gen1, gen2, gen3, gen4, previous]);

  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = recordId
            ? await updateGeneratorLogAction(recordId, fd)
            : await createGeneratorLogAction(fd);
          if (result && "error" in result && result.error) {
            setError(result.error);
            return;
          }
          onSuccess?.();
        });
      }}
    >
      <input type="hidden" name="farmId" value={farmId} />
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
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["gen1Hours", "Gen 1", gen1, setGen1, previewDeltas.gen1],
            ["gen2Hours", "Gen 2", gen2, setGen2, previewDeltas.gen2],
            ["gen3Hours", "Gen 3", gen3, setGen3, previewDeltas.gen3],
            ["gen4Hours", "Gen 4", gen4, setGen4, previewDeltas.gen4],
          ] as const
        ).map(([name, label, value, setValue, delta]) => (
          <div key={name}>
            <Label htmlFor={`gen-${name}`}>{label} hours</Label>
            <Input
              id={`gen-${name}`}
              name={name}
              type="text"
              inputMode="decimal"
              required
              value={value}
              placeholder="0"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
              className="placeholder:text-stone-400/70"
            />
            <p className="mt-1 text-xs text-stone-500">
              Time exercised: {formatGeneratorHours(delta)}
            </p>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : recordId ? "Save" : "Log generators"}
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

export function FarmGeneratorLogSection({
  farmId,
  logs,
}: {
  farmId: string;
  logs: GeneratorLogRow[];
}) {
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const allSorted = useMemo(
    () => [...logs].sort((a, b) => b.logDate.localeCompare(a.logDate) || b.id.localeCompare(a.id)),
    [logs],
  );

  const sorted = useMemo(
    () => allSorted.slice(0, MAX_GENERATOR_LOGS_DISPLAY),
    [allSorted],
  );

  const chartRowsByGen = useMemo(() => {
    return GEN_CHARTS.map((gen) => ({
      ...gen,
      rows: sorted.map((log, index) => {
        const previous = allSorted[index + 1] ?? null;
        const hours: GeneratorHours = {
          gen1Hours: log.gen1Hours,
          gen2Hours: log.gen2Hours,
          gen3Hours: log.gen3Hours,
          gen4Hours: log.gen4Hours,
        };
        const prevHours = previous
          ? {
              gen1Hours: previous.gen1Hours,
              gen2Hours: previous.gen2Hours,
              gen3Hours: previous.gen3Hours,
              gen4Hours: previous.gen4Hours,
            }
          : null;
        const deltas = generatorDeltas(hours, prevHours);
        return {
          id: log.id,
          dateLabel: dateLabelFromKey(log.logDate),
          hours: log[gen.hourKey],
          exercised: deltas[gen.deltaKey],
        } satisfies ChartRow;
      }),
    }));
  }, [sorted, allSorted]);

  const latestNumbersOnly = useMemo(() => {
    const latest = allSorted[0];
    if (!latest) return "";
    const previous = allSorted[1] ?? null;
    const hours: GeneratorHours = {
      gen1Hours: latest.gen1Hours,
      gen2Hours: latest.gen2Hours,
      gen3Hours: latest.gen3Hours,
      gen4Hours: latest.gen4Hours,
    };
    const prevHours = previous
      ? {
          gen1Hours: previous.gen1Hours,
          gen2Hours: previous.gen2Hours,
          gen3Hours: previous.gen3Hours,
          gen4Hours: previous.gen4Hours,
        }
      : null;
    return formatGeneratorCopyLine(hours, generatorDeltas(hours, prevHours));
  }, [allSorted]);

  useEffect(() => {
    if (generatorsHashActive()) setOpen(true);

    function onHashChange() {
      if (generatorsHashActive()) {
        setOpen(true);
        setFormOpen(false);
        setEditingId(null);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function closeSection() {
    setOpen(false);
    setFormOpen(false);
    setEditingId(null);
    if (generatorsHashActive()) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function afterSaved() {
    setFormOpen(false);
    setEditingId(null);
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

  const editingLog = editingId ? sorted.find((l) => l.id === editingId) : null;
  const editingIndex = editingLog ? sorted.findIndex((l) => l.id === editingLog.id) : -1;
  const editingPrevious =
    editingIndex >= 0 && sorted[editingIndex + 1]
      ? {
          gen1Hours: sorted[editingIndex + 1]!.gen1Hours,
          gen2Hours: sorted[editingIndex + 1]!.gen2Hours,
          gen3Hours: sorted[editingIndex + 1]!.gen3Hours,
          gen4Hours: sorted[editingIndex + 1]!.gen4Hours,
        }
      : null;

  return (
    <div id="generators" className="scroll-mt-24">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">Generator log</h3>
          <div className="flex items-center gap-3">
            {latestNumbersOnly ? (
              <CopyLogButton text={latestNumbersOnly} label="Copy numbers" />
            ) : null}
            <button
              type="button"
              onClick={closeSection}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
        </div>

        {editingLog ? (
          <GeneratorLogForm
            farmId={farmId}
            recordId={editingLog.id}
            initial={editingLog}
            previous={editingPrevious}
            onSuccess={afterSaved}
            onCancel={() => setEditingId(null)}
          />
        ) : null}

        {sorted.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">None yet</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {chartRowsByGen.map((gen) => (
              <GeneratorHoursChart
                key={gen.key}
                title={gen.label}
                rows={gen.rows}
                onEdit={(id) => {
                  setFormOpen(false);
                  setEditingId(id);
                }}
                onDelete={async (id) => {
                  await deleteGeneratorLogAction(id);
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {!formOpen ? (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
          className="mt-3 text-sm text-emerald-800 hover:underline"
        >
          Log generators
        </button>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-sm text-emerald-800 hover:underline"
          >
            Log generators
          </button>
          <Card className="mt-3">
            <GeneratorLogForm
              farmId={farmId}
              previous={
                sorted[0]
                  ? {
                      gen1Hours: sorted[0].gen1Hours,
                      gen2Hours: sorted[0].gen2Hours,
                      gen3Hours: sorted[0].gen3Hours,
                      gen4Hours: sorted[0].gen4Hours,
                    }
                  : null
              }
              onSuccess={afterSaved}
              onCancel={() => setFormOpen(false)}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
