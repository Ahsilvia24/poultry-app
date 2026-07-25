import Link from "next/link";
import { cn } from "@/lib/utils";

const linkClass =
  "flex min-h-10 items-center justify-center rounded-lg border border-emerald-800/20 bg-emerald-700 px-2.5 text-center text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-800";

export function FarmQuickLinks({ farmId }: { farmId: string }) {
  const links: Array<{ href: string; label: string; external?: boolean }> = [
    { href: "#visits", label: "Visits" },
    { href: "#issues", label: "Issues" },
    { href: "#litter", label: "Litter" },
    { href: "#feed", label: "Feed" },
    { href: `/history/${farmId}`, label: "History", external: true },
    { href: `/reports?farmId=${farmId}`, label: "Reports", external: true },
  ];

  return (
    <CardShell>
      <h2 className="text-sm font-bold text-stone-900">Quick links</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 shadow-sm")}>{children}</div>
  );
}
