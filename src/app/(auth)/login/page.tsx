"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { Button, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-stone-800">Sign in</h1>
        <p className="mt-1 text-sm text-stone-600">Service technician farm management</p>
        <form action={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required defaultValue="tech@poultry.local" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required defaultValue="password123" />
          </div>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-600">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-emerald-800 underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
