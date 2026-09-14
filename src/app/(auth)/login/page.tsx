"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { ensureDeviceId } from "@/lib/device-id";
import { replaceLoginWarning } from "@/lib/replace-login";

function LoginForm() {
  const params = useSearchParams();
  const resetOk = params.get("reset") === "1";
  const replaced = params.get("replaced") === "1";
  const urlError = params.get("error") === "1";
  const urlConfirm = params.get("confirm");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(urlError ? "Invalid email or password" : null);
  const [warning, setWarning] = useState<{ unsynced: boolean; knownOtherDevice: boolean } | null>(
    urlConfirm === "unsynced" || urlConfirm === "replace"
      ? { unsynced: urlConfirm === "unsynced", knownOtherDevice: params.get("other") === "1" }
      : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const body = {
      email: String(new FormData(form).get("email") ?? "").trim().toLowerCase(),
      password: String(new FormData(form).get("password") ?? ""),
      confirmReplace: warning != null,
      deviceId: ensureDeviceId(),
    };
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        needsConfirm?: boolean;
        unsynced?: boolean;
        knownOtherDevice?: boolean;
      };
      if (data.needsConfirm) {
        setWarning({
          unsynced: Boolean(data.unsynced),
          knownOtherDevice: Boolean(data.knownOtherDevice),
        });
        setPending(false);
        return;
      }
      if (!res.ok || data.error) {
        setError("Invalid email or password");
        setPending(false);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Invalid email or password");
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
            This sign-in expired. If this phone still has work that has not uploaded, wait for
            a signal before you sign in again or that work may be lost.
          </p>
        ) : null}
        <form
          action="/api/login"
          method="post"
          className="mt-6 space-y-4"
          onSubmit={onSubmit}
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {warning != null ? (
            <>
              <input type="hidden" name="confirmReplace" value="1" />
              <p className="text-sm font-medium text-amber-900">
                {replaceLoginWarning(warning.unsynced, warning.knownOtherDevice)}
              </p>
            </>
          ) : (
            <p className="text-sm text-stone-600">
              One device at a time. Signing in here signs out any other phone.
            </p>
          )}
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : warning != null ? "Sign in anyway" : "Sign in"}
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
