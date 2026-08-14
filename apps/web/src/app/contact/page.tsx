import { AppShell } from '@/components/app-shell';
import { MODERATION_CONTACT } from '@/lib/safety';

export const metadata = { title: 'Contact' };

/**
 * Published contact information.
 *
 * The fourth thing App Store guideline 1.2 requires: a UGC app must publish a
 * way to reach the developer. Reviewers look for it, so it is a real page with
 * real addresses rather than a link buried in a policy document.
 */
export default function ContactPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[520px] pt-4">
        <h1 className="display text-[34px] leading-tight text-white">Contact</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          A person reads everything sent here.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <Row
            label="Report content or a user"
            value={MODERATION_CONTACT.email}
            detail={`We respond ${MODERATION_CONTACT.responseTime}. You can also report any look directly from its page.`}
          />
          <Row
            label="Support"
            value="help@viola.app"
            detail="Accounts, billing, anything that is not working."
          />
          <Row
            label="Privacy"
            value="privacy@viola.app"
            detail="Data requests, deletion, and anything about what we store."
          />
        </div>

        <div className="surface mt-7 px-5 py-5">
          <p className="label-caps text-[var(--color-text-tertiary)]">Moderation</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
            Every upload is checked automatically before it appears anywhere public, and anything
            flagged is held back for review. You can report any look, and you can block anyone —
            blocking hides their content from you and yours from them, immediately.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-4">
      <p className="label-caps text-[var(--color-text-tertiary)]">{label}</p>
      <a
        href={`mailto:${value}`}
        className="mt-1.5 block text-[16px] font-semibold text-[var(--color-viola-text)] hover:underline"
      >
        {value}
      </a>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {detail}
      </p>
    </div>
  );
}
