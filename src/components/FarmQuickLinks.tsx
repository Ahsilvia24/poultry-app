import Link from "next/link";
import { cn } from "@/lib/utils";

const linkClass =
  "flex min-h-16 items-center justify-center rounded-xl border border-emerald-800/20 bg-emerald-700 px-4 text-center text-lg font-bold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-800";

export function FarmQuickLinks({ farmId }: { farmId: string }) {
  const links: Array<{ href: string; label: string; external?: boolean }> = [
    { href: "#visits", label: "Visits" },
    { href: "#issues", label: "Issues" },
    { href: "#weight-projections", label: "Weight projections" },
    { href: "#litter", label: "Litter events" },
    { href: `/history/${farmId}`, label: "Flock history", external: true },
    { href: `/reports?farmId=${farmId}`, label: "Reports", external: true },
    { href: "#add-flock", label: "Add flock" },
  ];

  return (
    <CardShell>
      <h2 className="font-bold text-stone-900">Quick links</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((link) =>
          link.external ? (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ) : (
            <a key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </a>
          ),
        )}
      </div>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-4 shadow-sm")}>{children}</div>
  );
}
