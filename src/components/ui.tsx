import { ReplicaLink } from "@/components/ReplicaLink";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800",
    secondary: "bg-stone-200 text-stone-900 hover:bg-stone-300",
    danger: "bg-red-700 text-white hover:bg-red-800",
    ghost: "bg-transparent text-stone-800 hover:bg-stone-100",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-[52px] items-center justify-center rounded-xl px-5 text-[17px] font-semibold transition disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  compact = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { compact?: boolean }) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-stone-300 bg-white font-semibold text-stone-900 caret-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200",
        compact ? "min-h-11 px-2.5 text-base" : "min-h-[52px] px-4 text-[17px]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  compact = false,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-stone-300 bg-white font-semibold text-stone-900 caret-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200",
        compact ? "min-h-11 px-2.5 text-base" : "min-h-[52px] px-4 text-[17px]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base font-medium text-stone-900 caret-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[15px] font-semibold text-stone-700">
      {children}
    </label>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[14px] border border-stone-200 bg-white p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Normal: "bg-emerald-100 text-emerald-900",
    Watch: "bg-amber-100 text-amber-900",
    High: "bg-orange-100 text-orange-900",
    Critical: "bg-red-100 text-red-900",
  };
  return (
    <span className={cn("inline-flex rounded-lg px-2.5 py-1 text-[13px] font-extrabold", colors[status] ?? "bg-stone-100")}>
      {status}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] text-stone-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function BackHeader({
  href,
  backLabel,
  title,
  subtitle,
}: {
  href: string;
  backLabel: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <ReplicaLink
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-1 text-[17px] font-bold text-emerald-800 hover:bg-emerald-50"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ←
          </span>
          {backLabel}
        </ReplicaLink>
        <h1 className="min-w-0 flex-1 text-right text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
          {title}
        </h1>
      </div>
      {subtitle ? (
        <p className="mt-1 text-right text-sm text-stone-600 md:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </Card>
  );
}
