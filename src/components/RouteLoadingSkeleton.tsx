export function RouteLoadingSkeleton({
  titleWidth = "w-36",
}: {
  titleWidth?: string;
}) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-live="polite">
      <div className={`h-7 rounded-md bg-stone-200 ${titleWidth}`} />
      <div className="h-24 rounded-xl bg-stone-200/80" />
      <div className="h-24 rounded-xl bg-stone-200/80" />
      <div className="h-40 rounded-xl bg-stone-200/70" />
    </div>
  );
}
