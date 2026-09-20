"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { isRegisterEmailAllowed } from "@/lib/allowedRegisterEmails";
import { upsertLocalAccount } from "@/lib/offline/localAccounts";
import { unlockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { tellWorkerSignedIn } from "@/lib/offline/signOutLocal";

function RegisterForm() {
  const params = useSearchParams();
  const urlError = params.get("error") === "1";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "Could not create that account." : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    const email = String(new FormData(form).get("email") ?? "").trim().toLowerCase();
    const password = String(new FormData(form).get("password") ?? "");
    if (!isRegisterEmailAllowed(email)) {
      setError("This email is not approved for an account.");
      setPending(false);
      return;
    }
    try {
      const account = await upsertLocalAccount({ email, password, name });
      unlockPhoneOwner(account.email);
      const session = await fetch("/api/local-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          email: account.email,
          userId: account.userId,
          name: account.name,
        }),
      });
      if (!session.ok) {
        setError("Could not start this sign-in. Try again.");
        setPending(false);
        return;
      }
      void fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ name, email, password }),
      }).catch(() => undefined);
      await tellWorkerSignedIn();
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that account.");
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto overscroll-none bg-[#f3efe6] px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="font-serif text-xl font-extrabold tracking-tight text-emerald-900">
          PoultryTech
        </p>
        <h1 className="mt-1.5 text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-stone-500">
          Farms stay on this phone under your email. You can start now without the website, then
          pull old farms later from Settings. Only approved emails can create an account.
        </p>
        <form
          action="/api/register"
          method="post"
          className="mt-6 space-y-4"
          onSubmit={onSubmit}
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
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
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
