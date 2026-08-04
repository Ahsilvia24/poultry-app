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
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-stone-500">Last updated: July 29, 2026</p>

        <div className="mt-8 space-y-6 text-base leading-relaxed text-stone-700">
          <p>
            This Privacy Policy describes how PoultryTech (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;), operated by Alex Silvia, collects, uses, and protects information
            when you use the PoultryTech mobile application and related web services (the
            &quot;Service&quot;).
          </p>

          <section>
            <h2 className="text-lg font-bold text-stone-900">1. Information we collect</h2>
            <p className="mt-2">Depending on how you use the Service, we may process:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-stone-900">Account information</span> — such
                as name, email address, and authentication credentials when you create or sign in
                to an account on the web Service.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Farm and operations data</span> —
                information you enter about farms, houses, flocks, mortality, feed, litter,
                visits, issues, LFO (last feed order), generators, and related notes or reports.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Device / local data (iOS app)</span> —
                the mobile app stores your operational data on your device (offline-first) so you
                can work without a constant internet connection. Backups or exports you choose to
                create are under your control.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Support communications</span> — if
                you contact us, we receive the content of your message and your contact details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">2. How we use information</h2>
            <p className="mt-2">We use information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide, maintain, and improve farm management features in the Service</li>
              <li>Authenticate users and protect accounts</li>
              <li>Respond to support requests and App Store / product inquiries</li>
              <li>Comply with legal obligations when required</li>
            </ul>
            <p className="mt-2">
              We do <span className="font-semibold text-stone-900">not</span> sell your personal
              information. We do not use your farm data for third-party advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">3. Data storage and security</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-stone-900">iOS app:</span> primary operational
                data is stored locally on your device. You are responsible for device security,
                backups you create, and who has physical access to the device.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Web Service:</span> account and farm
                data you enter online may be stored on our hosted servers so you can access the
                Service over the internet. We use reasonable administrative and technical
                safeguards appropriate for a small business application.
              </li>
            </ul>
            <p className="mt-2">
              No method of storage or transmission is 100% secure. Please use a strong password
              and keep your device updated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">4. Sharing of information</h2>
            <p className="mt-2">
              We do not share your personal or farm data with third parties for their marketing.
              We may share information only:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>With service providers who help us host or operate the Service, under obligations to protect it</li>
              <li>If required by law, regulation, or valid legal process</li>
              <li>To protect the rights, safety, or integrity of the Service or its users</li>
              <li>With your direction or consent (for example, if you export and send data yourself)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">5. Third-party services</h2>
            <p className="mt-2">
              Distribution through the Apple App Store is subject to Apple&apos;s terms and
              privacy practices. The Service may rely on standard hosting, authentication, or
              infrastructure providers to run the web app. Those providers process data only as
              needed to deliver the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">6. Children&apos;s privacy</h2>
            <p className="mt-2">
              PoultryTech is intended for adult service technicians and farm operators. It is not
              directed to children under 13, and we do not knowingly collect personal information
              from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">7. Your choices</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>You can edit or delete farm-related records you enter in the app, subject to available app features.</li>
              <li>You can request account-related help or deletion by contacting us.</li>
              <li>You can stop using the Service and uninstall the iOS app at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">8. Changes to this policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. The &quot;Last updated&quot;
              date at the top will change when we do. Continued use of the Service after an update
              means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">9. Contact</h2>
            <p className="mt-2">
              Questions about privacy or this policy:
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
                poultrytech support page
              </Link>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
