"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { Button, Input, Label } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await resetPasswordAction(formData);
    if (result?.error) setError(result.error);
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Reset link missing</h1>
          <p className="mt-2 text-sm text-stone-600">
            Use the link from your email, or request a new one.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/forgot-password" className="font-semibold text-emerald-800 underline">
              Forgot password
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="font-serif text-xl font-extrabold tracking-tight text-emerald-900">
          PoultryTech
        </p>
        <h1 className="mt-1.5 text-xl font-semibold">Set a new password</h1>
        <form action={onSubmit} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-stone-500">At least 8 characters.</p>
          </div>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full">
            Save password
          </Button>
        </form>
      </div>
    </div>
  );
}
