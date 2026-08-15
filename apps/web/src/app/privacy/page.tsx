import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

export const metadata = { title: 'Privacy' };

/**
 * Privacy Policy.
 *
 * Required for App Store review and for any real launch. Written in plain
 * language for the ICP — a policy nobody can read is not a policy.
 *
 * Last updated: 2026-08-15. Replace the operator entity name before filing.
 */
export default function PrivacyPage() {
  return (
    <AppShell>
      <article className="mx-auto w-full max-w-[640px] pt-4 pb-16">
        <p className="label-caps text-[var(--color-text-tertiary)]">Legal</p>
        <h1 className="display mt-1 text-[34px] leading-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-[13px] text-[var(--color-text-tertiary)]">Last updated August 15, 2026</p>

        <div className="prose-viola mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          <Section title="Who we are">
            Viola (“we”) is the outfit-sharing app operated at viola.app. Questions about this
            policy go to{' '}
            <a className="text-[var(--color-viola-text)] hover:underline" href="mailto:privacy@viola.app">
              privacy@viola.app
            </a>
            .
          </Section>

          <Section title="What we collect">
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Account.</strong> Email address, display name, and
                handle you choose.
              </li>
              <li>
                <strong className="text-white">Looks you post.</strong> Photos and captions you
                upload, plus the garment labels, scores, and product links we generate from them.
              </li>
              <li>
                <strong className="text-white">Activity.</strong> Blooms, views, saves, reports,
                blocks, and outbound shop taps (so we can attribute affiliate commissions).
              </li>
              <li>
                <strong className="text-white">Device &amp; session.</strong> A session token on your
                device, coarse analytics events (no ad-tracking ID), and basic server logs.
              </li>
              <li>
                <strong className="text-white">Payments.</strong> Subscription status from Apple /
                Stripe. We never see or store your full card number.
              </li>
            </ul>
          </Section>

          <Section title="What we deliberately do not keep">
            Location EXIF is stripped from every photo before it is stored. We do not sell personal
            data. We do not run a third-party ad SDK at launch, so we do not request the App
            Tracking Transparency prompt for advertising.
          </Section>

          <Section title="How we use it">
            To run the product: identify garments, show where to buy them, power Blooms and
            Vaults, moderate UGC, prevent abuse, and improve the experience. Affiliate networks
            receive only what is needed to attribute a shop click (a tracking id we mint) — not your
            email.
          </Section>

          <Section title="Who we share with">
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Infrastructure providers that host the app and store media.</li>
              <li>Vision and product-search providers that process look photos to identify items.</li>
              <li>Affiliate networks when you tap Shop (commission attribution).</li>
              <li>Apple (StoreKit / Superwall) and Whop for Viola Plus billing.</li>
              <li>Law enforcement when legally required.</li>
            </ul>
          </Section>

          <Section title="Your choices">
            You can download your data and delete your account from Settings. Deletion removes your
            profile, looks, and personal identifiers from our primary systems. Aggregated analytics
            and legally retained financial records may remain.
          </Section>

          <Section title="Children">
            Viola is not directed at children under 13. We do not knowingly collect their data. If
            you believe we have, email privacy@viola.app and we will delete it.
          </Section>

          <Section title="International">
            Data may be processed in the United States and other countries where our providers
            operate. By using Viola you understand that.
          </Section>

          <Section title="Changes">
            We will update this page when the policy changes and revise the date above.
          </Section>
        </div>

        <p className="mt-10 text-[13px] text-[var(--color-text-tertiary)]">
          Also see our <Link href="/terms" className="text-[var(--color-viola-text)] hover:underline">Terms of Use</Link>
          {' '}and <Link href="/contact" className="text-[var(--color-viola-text)] hover:underline">Contact</Link>.
        </p>
      </article>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display text-[22px] text-white">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
