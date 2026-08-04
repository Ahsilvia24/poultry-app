import Link from "next/link";
import { cn } from "@/lib/utils";

/** Short chevron + page-title-sized back label (matches farm detail Farms control). */
export function PageTitleBackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg text-emerald-800 hover:bg-emerald-50",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 8 16"
        className="h-5 w-2.5 shrink-0 fill-none stroke-current stroke-[2.5] sm:h-6 sm:w-3"
      >
        <path d="M6 2 2 8l4 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Inherit link color — PAGE_TITLE_CLASS includes text-stone-900 which would win. */}
      <h1 className="font-serif text-2xl font-extrabold tracking-tight text-inherit sm:text-3xl">
        {label}
      </h1>
    </Link>
  );
}
