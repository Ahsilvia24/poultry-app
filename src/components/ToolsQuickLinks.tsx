import { cn } from "@/lib/utils";

const linkClass =
  "flex min-h-10 items-center justify-center rounded-lg border border-emerald-800/20 bg-emerald-700 px-2.5 text-center text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-800";

const links = [
  { href: "#temp-curve", label: "Temp Curve" },
  { href: "#cool-cells", label: "Cool Cells" },
  { href: "#max-cooling", label: "Max Cooling" },
  { href: "#lights", label: "Lights" },
  { href: "#ventilation", label: "Ventilation" },
  { href: "#phone-numbers", label: "Phone Numbers" },
] as const;

export function ToolsQuickLinks() {
  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 shadow-sm")}>
      <h2 className="text-sm font-bold text-stone-900">Quick links</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {links.map((link) => (
          <a key={link.href} href={link.href} className={linkClass}>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
