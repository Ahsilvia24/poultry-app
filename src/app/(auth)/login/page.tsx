"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Button, Input, Label } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  const resetOk = params.get("reset") === "1";
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-center font-serif text-xl font-extrabold tracking-tight text-emerald-900">
          PoultryTech
        </h1>
        {resetOk ? (
          <p className="mt-3 text-center text-sm font-medium text-emerald-800">
            Password saved. Sign in with your new password.
          </p>
        ) : null}
        <form action={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-3 text-center text-sm text-stone-600">
          <Link href="/forgot-password" className="font-semibold text-emerald-800 underline">
            Forgot password
          </Link>
        </p>
        <p className="mt-4 text-center text-sm text-stone-600">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-emerald-800 underline">
            Register
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-stone-600">
          <a
            href="https://poultrytechapp.com/support/"
            className="font-semibold text-emerald-800 underline"
          >
            Support
          </a>
          {" · "}
          <a
            href="https://poultrytechapp.com/privacy/"
            className="font-semibold text-emerald-800 underline"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
