export default function ServiceFarmLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="h-6 w-24 rounded-md bg-stone-200" />
        <div className="h-7 w-36 rounded-md bg-stone-200" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-12 rounded-lg bg-emerald-700/15" />
        <div className="h-12 rounded-lg bg-emerald-700/15" />
        <div className="h-12 rounded-lg bg-emerald-700/15" />
      </div>
      <div className="h-28 rounded-xl bg-stone-200/80" />
    </div>
  );
}
