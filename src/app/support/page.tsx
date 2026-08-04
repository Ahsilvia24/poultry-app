import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — PoultryTech",
  description: "PoultryTech app support and contact information",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f5f2eb] px-6 py-12 text-stone-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          PoultryTech
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
          Support
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Need help with the PoultryTech app for farm management, mortality entry, LFO, or
          reports? Contact us and we&apos;ll get back to you as soon as we can.
        </p>

        <div className="mt-8 space-y-4 text-base">
          <div>
            <p className="text-sm font-semibold text-stone-500">Email</p>
            <a
              href="mailto:talentpro024@gmail.com"
              className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
            >
              talentpro024@gmail.com
            </a>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-500">App</p>
            <p className="font-medium text-stone-800">PoultryTech (iOS)</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-500">Typical response</p>
            <p className="text-stone-700">Within 1–2 business days</p>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
          <p className="font-semibold text-stone-900">App Store review demo access</p>
          <p className="mt-2">
            Sign in with the prefilled demo account on the login screen, or use:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Email: <span className="font-semibold">tech@poultry.local</span>
            </li>
            <li>
              Password: <span className="font-semibold">password123</span>
            </li>
          </ul>
          <p className="mt-2 text-stone-500">
            Demo farms and houses load automatically on first launch. No internet required after
            install.
          </p>
        </div>
        <p className="mt-4 text-sm text-stone-500">
          <Link
            href="/privacy"
            className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
