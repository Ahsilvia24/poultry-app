"use client";

import { useRef, useState, type ReactNode } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui";

const fieldClass =
  "h-11 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-[15px] font-semibold text-stone-900 outline-none placeholder:font-semibold placeholder:tracking-wide placeholder:text-stone-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200";

function Line({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label htmlFor={htmlFor} className="w-[4.75rem] shrink-0 text-[15px] font-semibold leading-none text-stone-800">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setOk(false);
    const result = await changePasswordAction(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOk(true);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-1 overflow-visible">
      <h2 className="font-bold leading-tight text-stone-900">Change password</h2>
      <Line label="Current:" htmlFor="currentPassword">
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          placeholder="********"
          className={fieldClass}
        />
      </Line>
      <Line label="New:" htmlFor="newPassword">
        <input
          id="newPassword"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="********"
          className={fieldClass}
        />
      </Line>
      <Line label="Confirm:" htmlFor="confirmPassword">
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="********"
          className={fieldClass}
        />
      </Line>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm font-medium text-emerald-800">Password updated.</p> : null}
      <Button type="submit" className="mt-3">
        Change password
      </Button>
    </form>
  );
}
