"use client";

import { useEffect } from "react";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useRouter } from "next/navigation";
import { AddEndFlockButton, PastFlocksButton } from "@/components/FarmFlockMenus";
import { cn } from "@/lib/utils";

const linkClass =
  "flex h-12 w-full items-center justify-center overflow-hidden rounded-lg border border-emerald-800/20 bg-emerald-700 px-2 text-center text-[15px] font-extrabold leading-tight text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-800";

type ActiveFlockOption = {
  id: string;
  flockNumber: string;
  ageDays: number;
  housesLabel: string;
};

type PastFlockOption = {
  id: string;
  flockNumber: string;
  housesLabel: string;
};

export function FarmQuickLinks({
  farmId,
  completeFlocks = [],
  pastFlocks = [],
  onAddFlock,
}: {
  farmId: string;
  completeFlocks?: ActiveFlockOption[];
  pastFlocks?: PastFlockOption[];
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
  }> = [
    { key: "service", href: serviceHref, label: "Service Farm" },
    { key: "generators", href: generatorsHref, label: "Generator" },
    { key: "visits", href: visitsHref, label: "Visits" },
    { key: "issues", href: issuesHref, label: "Issues" },
    { key: "litter", href: litterHref, label: "Litter" },
    { key: "feed", href: feedHref, label: "Feed" },
    { key: "lfo", href: `/lfo?farmId=${farmId}`, label: "LFO" },
  ];

  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 shadow-sm")}>
      <div className="grid grid-cols-3 gap-2">
        {links.map((link) => (
          <ReplicaLink
            key={link.key}
            href={link.href}
            prefetch
            onTouchStart={() => router.prefetch(link.href)}
            onPointerEnter={() => router.prefetch(link.href)}
            className={linkClass}
          >
            {link.label}
          </ReplicaLink>
        ))}
        <AddEndFlockButton
          farmId={farmId}
          flocks={completeFlocks}
          className={linkClass}
          onAddFlock={onAddFlock}
        />
        <PastFlocksButton farmId={farmId} flocks={pastFlocks} className={linkClass} />
      </div>
    </div>
  );
}
