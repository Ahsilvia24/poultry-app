import type { Metadata } from "next";

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
          Need help with the PoultryTech app for farm management, mortality entry, LFO, or
          reports? Contact us and we&apos;ll get back to you as soon as we can.
        </p>

        <div className="mt-8 space-y-4 text-base">
          <div>
            <p className="text-sm font-semibold text-stone-500">Email</p>
            <a
              href="mailto:alexsilvia24@yahoo.com"
              className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
            >
              alexsilvia24@yahoo.com
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
          For App Store review questions about demo access or account setup, email the address
          above and mention Apple App Review.
        </p>
      </div>
    </main>
  );
}
