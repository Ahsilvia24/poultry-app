"use client";

export function FarmLogSectionHeader({
  title,
  extraRight,
  logLabel,
  onLog,
}: {
  title: string;
  extraRight?: React.ReactNode;
  logLabel: string;
  onLog: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="min-w-0 flex-1 text-xl font-extrabold">{title}</h3>
      <div className="flex shrink-0 items-center gap-3">
        {extraRight}
        <button
          type="button"
          onClick={onLog}
          className="text-sm text-emerald-800 hover:underline"
        >
          {logLabel}
        </button>
      </div>
    </div>
  );
}

export function FarmLogSectionTop() {
  return (
    <div className="mb-4 mt-2">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })}
        className="text-sm font-semibold text-stone-500 hover:text-stone-800"
      >
        Top
      </button>
    </div>
  );
}
