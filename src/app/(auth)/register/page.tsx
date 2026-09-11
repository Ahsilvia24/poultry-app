"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

function RegisterForm() {
  const params = useSearchParams();
  const urlError = params.get("error") === "1";
  const [pending, setPending] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="font-serif text-xl font-extrabold tracking-tight text-emerald-900">
          PoultryTech
        </p>
        <h1 className="mt-1.5 text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-stone-500">Only approved emails can create an account.</p>
        <form
          action="/api/register"
          method="post"
          className="mt-6 space-y-4"
          onSubmit={() => setPending(true)}
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
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
          {urlError ? (
            <p className="text-sm font-medium text-red-700">Could not create that account.</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-600">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-emerald-800 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
