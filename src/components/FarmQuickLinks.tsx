"use client";

import { useEffect } from "react";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useRouter } from "next/navigation";
import { CompleteFlockPicker } from "@/components/CompleteFlockPicker";
import { cn } from "@/lib/utils";

const linkClass =
  "flex h-12 w-full items-center justify-center overflow-hidden rounded-lg border border-emerald-800/20 bg-emerald-700 px-2 text-center text-[13px] font-semibold leading-tight text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-800";

type FlockOption = { id: string; flockNumber: string; ageDays: number };

export function FarmQuickLinks({
  farmId,
  completeFlocks = [],
  onAddFlock,
}: {
  farmId: string;
  completeFlocks?: FlockOption[];
  onAddFlock?: () => void;
}) {
  const router = useRouter();
  const serviceHref = `/farms/${farmId}/service`;
  const visitsHref = `/farms/${farmId}/visits`;
  const generatorsHref = `/farms/${farmId}/generators`;
  const issuesHref = `/farms/${farmId}/issues`;
  const litterHref = `/farms/${farmId}/litter`;
  const feedHref = `/farms/${farmId}/feed`;
  useEffect(() => {
    router.prefetch(serviceHref);
    router.prefetch(visitsHref);
    router.prefetch(generatorsHref);
    router.prefetch(issuesHref);
    router.prefetch(litterHref);
    router.prefetch(feedHref);
    router.prefetch(`/lfo?farmId=${farmId}`);
  }, [
    farmId,
    router,
    serviceHref,
    visitsHref,
    generatorsHref,
    issuesHref,
    litterHref,
    feedHref,
  ]);

  const links: Array<{
    key: string;
    href: string;
    label: string;
    external?: boolean;
    action?: () => void;
  }> = [
    { key: "service", href: serviceHref, label: "Service Farm", external: true },
    { key: "generators", href: generatorsHref, label: "Generator", external: true },
    { key: "visits", href: visitsHref, label: "Visits", external: true },
    { key: "issues", href: issuesHref, label: "Issues", external: true },
    { key: "litter", href: litterHref, label: "Litter", external: true },
    { key: "feed", href: feedHref, label: "Feed", external: true },
    { key: "lfo", href: `/lfo?farmId=${farmId}`, label: "LFO", external: true },
    { key: "add-flock", href: "", label: "Add Flock", action: onAddFlock },
  ];

  // Append End Flock after Add Flock when there is an active flock.
  const items: Array<
    | {
        kind: "link";
        key: string;
        href: string;
        label: string;
        external?: boolean;
        action?: () => void;
      }
    | { kind: "complete"; key: string }
  > = [];
  for (const link of links) {
    items.push({ kind: "link", ...link });
    if (link.key === "add-flock" && completeFlocks.length > 0) {
      items.push({ kind: "complete", key: "complete-flock" });
    }
  }

  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 shadow-sm")}>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          if (item.kind === "complete") {
            return (
              <CompleteFlockPicker
                key={item.key}
                farmId={farmId}
                flocks={completeFlocks}
                appearance="quickLink"
                className={linkClass}
              />
            );
          }
          if (item.key === "add-flock") {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => item.action?.()}
                className={linkClass}
              >
                {item.label}
              </button>
            );
          }
          return (
            <ReplicaLink
              key={item.key}
              href={item.href}
              prefetch
              onTouchStart={() => router.prefetch(item.href)}
              onPointerEnter={() => router.prefetch(item.href)}
              className={linkClass}
            >
              {item.label}
            </ReplicaLink>
          );
        })}
      </div>
    </div>
  );
}
