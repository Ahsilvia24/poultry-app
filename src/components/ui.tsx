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
        "inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-semibold transition disabled:opacity-50",
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
        compact ? "min-h-11 px-2.5 text-base" : "min-h-12 px-4 text-lg",
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
        compact ? "min-h-11 px-2.5 text-base" : "min-h-12 px-4 text-lg",
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
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-stone-700">
      {children}
    </label>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 shadow-sm md:p-4", className)}>
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
    <span className={cn("inline-flex rounded-md px-2.5 py-1 text-sm font-bold", colors[status] ?? "bg-stone-100")}>
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
    <div className="mb-3 flex flex-col gap-2 md:mb-6 md:gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-stone-900 md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-stone-600 md:mt-1 md:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
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
