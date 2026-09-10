"use client";

import { useRef, useState, type ReactNode } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button, Input } from "@/components/ui";

const inlineInputClass =
  "min-h-0 flex-1 border-0 bg-transparent px-0 py-1 text-base font-semibold shadow-none focus:border-transparent focus:ring-0";

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
    <div className="flex items-center gap-3">
      <label htmlFor={htmlFor} className="shrink-0 text-sm font-semibold text-stone-800">
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
    <form ref={formRef} action={onSubmit} className="space-y-2">
      <h2 className="font-bold text-stone-900">Change password</h2>
      <Line label="Current:" htmlFor="currentPassword">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inlineInputClass}
        />
      </Line>
      <Line label="New:" htmlFor="newPassword">
        <Input
          id="newPassword"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className={inlineInputClass}
        />
      </Line>
      <Line label="Confirm:" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className={inlineInputClass}
        />
      </Line>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm font-medium text-emerald-800">Password updated.</p> : null}
      <Button type="submit" className="mt-2">
        Change password
      </Button>
    </form>
  );
}
