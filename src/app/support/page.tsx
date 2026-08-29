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
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Support</h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          PoultryTech is operated by Alex Silvia. Need help with farm management, mortality
          entry, LFO, or reports? Contact us and we&apos;ll get back to you as soon as we can.
        </p>

        <div className="mt-8 space-y-4 text-base">
          <div>
            <p className="text-sm font-semibold text-stone-500">Operator</p>
            <p className="font-medium text-stone-800">Alex Silvia</p>
          </div>
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

        <p className="mt-10 text-sm text-stone-500">
          For help with PoultryTech, email the address above.
        </p>
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
