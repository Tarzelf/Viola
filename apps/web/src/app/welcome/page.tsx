import Link from 'next/link';
import { LanderHero } from '@/components/lander-hero';

export const metadata = {
  title: 'Viola — post your fit, and voilà',
  description: 'Every piece identified, scored, and shoppable. Built for the group chat.',
};

/**
 * Dedicated marketing lander. First viewport is brand + one CTA into the app.
 */
export default function WelcomePage() {
  return (
    <main>
      <LanderHero primaryHref="/new" primaryLabel="Post your first fit" secondaryHref="/" secondaryLabel="Browse looks" />
      <section className="mx-auto max-w-[720px] px-5 py-20 text-center">
        <h2 className="display text-[28px] text-white">How it works</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Upload a mirror selfie. Viola finds every piece, lays them over your photo, scores the
          vibe, and hands you a card made for iMessage.
        </p>
        <div className="mt-10 grid gap-8 text-left sm:grid-cols-3">
          {[
            ['1. Snap', 'A regular selfie is enough. Location EXIF is stripped.'],
            ['2. Reveal', 'Pieces pop in. Score lands. The room reacts.'],
            ['3. Share', 'One tap to Messages. Friends Bloom with no signup.'],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="label-caps text-[var(--color-viola-text)]">{title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                {body}
              </p>
            </div>
          ))}
        </div>
        <Link
          href="/early"
          className="mt-12 inline-block text-[13px] text-[var(--color-text-tertiary)] hover:text-white"
        >
          Request early access →
        </Link>
      </section>
    </main>
  );
}
