import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — PoultryTech",
  description: "Privacy Policy for the PoultryTech farm management app",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#f5f2eb] px-6 py-12 text-stone-900">
      <article className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          PoultryTech
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated: August 28, 2026</p>

        <div className="mt-8 space-y-6 text-base leading-relaxed text-stone-700">
          <p>
            PoultryTech is operated by Alex Silvia. This policy describes how we collect, use, and
            protect information in the PoultryTech iOS app and related web services.
          </p>

          <section>
            <h2 className="text-lg font-bold text-stone-900">1. Who we are</h2>
            <p className="mt-2">
              PoultryTech is an independent farm-management tool for poultry service technicians.
              It is not a Bachoco app and is not published by Industrias Bachoco. Contact:{" "}
              <a
                href="mailto:talentpro024@gmail.com"
                className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                talentpro024@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">2. Information we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-stone-900">Account information (web)</span> —
                name, email, and password when you register or sign in on the web service.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Farm and operations data</span> —
                farms, houses, flocks, mortality, feed, litter, visits, issues, last-feed orders,
                generators, and notes you enter.
              </li>
              <li>
                <span className="font-semibold text-stone-900">iOS app (on-device)</span> — that
                operational data is stored in a local database on your phone so the app works
                offline.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Files you choose to import</span> —
                placement or catch-schedule files you pick with the system file picker. We do not
                browse your photo library or contacts.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Support email</span> — if you write
                to us, we receive your message and address.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">3. What we do not collect</h2>
            <p className="mt-2">
              The iOS app does <span className="font-semibold text-stone-900">not</span> collect
              location, contacts, camera, microphone, advertising IDs, or analytics SDKs. We do
              not send marketing email or SMS. We do not use Mouseflow, Freshdesk, Google Places,
              or similar third-party trackers. We do not sell personal information or farm data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">4. How we use information</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide farm-management features you ask for</li>
              <li>Sign you in on the web service</li>
              <li>Respond to support and App Store questions</li>
              <li>Comply with law when required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">5. Storage</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-stone-900">iOS:</span> primary data stays on
                the device.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Web:</span> accounts and farm
                records you enter online are stored on our host so you can use the web service.
                Hosting providers process data only to run the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">6. Sharing</h2>
            <p className="mt-2">
              We do not share personal or farm data for third-party marketing. We share only with
              infrastructure needed to run the service, if required by law, or when you choose to
              share a report yourself.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">7. Children</h2>
            <p className="mt-2">
              PoultryTech is for adult technicians and farm operators. It is not directed to
              children under 13, and we do not knowingly collect their information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">8. Your choices</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Edit or delete records in the app</li>
              <li>Email us to request help deleting web account data</li>
              <li>Uninstall the iOS app at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">9. Changes</h2>
            <p className="mt-2">
              We may update this policy. The date above changes when we do.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">10. Contact</h2>
            <p className="mt-2">
              Alex Silvia · PoultryTech
              <br />
              <a
                href="mailto:talentpro024@gmail.com"
                className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                talentpro024@gmail.com
              </a>
            </p>
            <p className="mt-2">
              Support:{" "}
              <Link
                href="/support"
                className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                PoultryTech support page
              </Link>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
