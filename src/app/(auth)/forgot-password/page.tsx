"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthBrand } from "@/components/AuthBrand";
import { Button, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await forgotPasswordAction(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <AuthBrand />
        <h1 className="mt-1.5 text-xl font-semibold">Forgot password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-stone-600">
            If that email has an account, we sent a reset link. Check the inbox and spam
            folder. The link expires in one hour.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone-600">
              Enter your email. We will send a link to set a new password.
            </p>
            <form action={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
          </>
        )}
        <p className="mt-4 text-center text-sm text-stone-600">
          <Link href="/login" className="font-semibold text-emerald-800 underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
