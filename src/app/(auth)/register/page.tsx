"use client";

import { useState } from "react";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { Button, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await registerAction(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <img
          src="/chick-icon.png"
          alt=""
          width={72}
          height={72}
          className="mx-auto h-[72px] w-[72px]"
        />
        <h1 className="mt-4 text-center text-xl font-semibold">Create your account</h1>
        <p className="mt-2 text-center text-sm text-stone-600">
          Use your own email on the website and the iPhone app. You start with an empty farm
          list. Other technicians cannot see or change your data.
        </p>
        <form action={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full">
            Create account
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
