"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { SafariLink } from "@/components/SafariLink";
import { isRegisterEmailAllowed } from "@/lib/allowedRegisterEmails";
import { getLocalAccount, upsertLocalAccount, verifyLocalAccount } from "@/lib/offline/localAccounts";
import { unlockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { keepSignedOutOnLogin, tellWorkerSignedIn } from "@/lib/offline/signOutLocal";

async function startLocalSession(account: { email: string; userId: string; name: string }) {
  unlockPhoneOwner(account.email);
  const res = await fetch("/api/local-session", {
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
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || data.error) throw new Error(data.error || "Could not start this sign-in.");
}

function LoginForm() {
  const params = useSearchParams();
  const resetOk = params.get("reset") === "1";
  const replaced = params.get("replaced") === "1";
  const urlError = params.get("error") === "1";
  const signedOut = params.get("signedout") === "1";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(urlError ? "Invalid email or password" : null);

  useEffect(() => {
    if (!signedOut) return;
    void keepSignedOutOnLogin();
  }, [signedOut]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim().toLowerCase();
    const password = String(new FormData(form).get("password") ?? "");
    if (!email.includes("@")) {
      setError("Use the email for this account.");
      setPending(false);
      return;
    }
    try {
      const local = await verifyLocalAccount(email, password);
      if (local) {
        await startLocalSession(local);
        await tellWorkerSignedIn();
        window.location.assign("/");
        return;
      }
      const existing = await getLocalAccount(email);
      if (existing) {
        setError("Invalid email or password");
        setPending(false);
        return;
      }
      if (!isRegisterEmailAllowed(email)) {
        setError("This email is not approved for an account.");
        setPending(false);
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setPending(false);
        return;
      }
      const account = await upsertLocalAccount({
        email,
        password,
        name: email.split("@")[0],
      });
      await startLocalSession(account);
      await tellWorkerSignedIn();
      window.location.assign("/");
    } catch {
      setError("Could not start this sign-in. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto overscroll-none bg-[#f3efe6] px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-center font-serif text-xl font-extrabold tracking-tight text-emerald-900">
          PoultryTech
        </h1>
        {resetOk ? (
          <p className="mt-3 text-center text-sm font-medium text-emerald-800">
            Password saved. Sign in with your new password.
          </p>
        ) : null}
        {replaced ? (
          <p className="mt-3 text-center text-sm font-medium text-stone-800">
            This sign-in expired. Farms stay on this phone. Sign in with the same email to
            open them.
          </p>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <p className="text-sm text-stone-600">
            Farms stay on this phone. Each phone has its own copy. Move data with Export all
            app data in Settings.
          </p>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-600">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-emerald-800 underline">
            Register
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-stone-600">
          <SafariLink href="/support" className="font-semibold text-emerald-800 underline">
            Support
          </SafariLink>
          {" · "}
          <SafariLink href="/privacy" className="font-semibold text-emerald-800 underline">
            Privacy Policy
          </SafariLink>
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
