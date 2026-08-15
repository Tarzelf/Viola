import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

/**
 * Marketing lander — first viewport only.
 *
 * Brand first, one headline, one supporting line, one CTA group, one full-bleed
 * visual plane. Drives people into the product (post a fit / open the feed),
 * not into a brochure.
 */
export function LanderHero({
  primaryHref = '/new',
  primaryLabel = 'Post your first fit',
  secondaryHref = '/',
  secondaryLabel = 'See the feed',
}: {
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="relative isolate min-h-[100dvh] w-full overflow-hidden">
      {/* Full-bleed visual plane — atmospheric, brand-owned, not a card. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 90% 70% at 70% 20%, rgba(124, 92, 252, 0.38), transparent 55%),
            radial-gradient(ellipse 70% 50% at 15% 85%, rgba(233, 169, 255, 0.16), transparent 50%),
            linear-gradient(180deg, #0B0A0F 0%, #141220 48%, #0B0A0F 100%)
          `,
        }}
      />
      {/* Soft mirror-selfie silhouette suggestion without stock photography. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[12%] right-[-8%] hidden w-[55%] sm:block"
        style={{
          background:
            'linear-gradient(135deg, rgba(251,249,251,0.07) 0%, rgba(124,92,252,0.12) 40%, transparent 70%)',
          clipPath: 'polygon(28% 0%, 100% 0%, 100% 100%, 8% 100%)',
          filter: 'blur(0px)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[18%] right-[12%] hidden h-[58%] w-[34%] rounded-[40%_40%_32%_32%/28%_28%_42%_42%] bg-white/[0.06] ring-1 ring-white/10 sm:block"
        style={{
          animation: 'viola-rise 900ms var(--ease-gentle) both',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1120px] flex-col px-5 pt-6 pb-10 sm:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Viola home">
            <Wordmark size={26} />
          </Link>
          <Link
            href="/signin"
            className="text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </header>

        <div className="t-stagger is-shown flex flex-1 flex-col justify-center py-16 sm:max-w-[560px] sm:py-0">
          <strong className="t-stagger-line t-stagger-line--1 display text-[52px] leading-[0.98] tracking-[-0.02em] text-white sm:text-[72px]">
            Post your fit.
            <br />
            <span className="text-[var(--color-viola-text)]">Voilà.</span>
          </strong>
          <span className="t-stagger-line t-stagger-line--2 mt-5 max-w-[34ch] text-[17px] leading-relaxed text-[var(--color-text-secondary)] sm:text-[18px]">
            Every piece named, scored, and shoppable — then one tap into iMessage.
          </span>

          <div
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animation: 'viola-rise 520ms var(--ease-gentle) 180ms both' }}
          >
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-viola)] px-7 py-4 text-[15px] font-semibold text-white shadow-[var(--shadow-glow)] transition-transform active:scale-[0.97]"
            >
              {primaryLabel}
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-4 text-[15px] font-medium text-white/85 transition-colors hover:border-white/30 hover:text-white"
            >
              {secondaryLabel}
            </Link>
          </div>

          <p
            className="mt-8 text-[12px] tracking-[0.04em] text-[var(--color-text-tertiary)]"
            style={{ animation: 'viola-rise 520ms var(--ease-gentle) 280ms both' }}
          >
            Free to post · Blooms only · No downvotes
          </p>
        </div>
      </div>
    </section>
  );
}
