'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Plan selection and checkout.
 *
 * When Stripe is not configured this offers a clearly-labelled development
 * upgrade instead, so the paid tier can be exercised on a fresh clone. That
 * path is refused by the server in production and whenever real keys exist.
 */
export function UpgradePanel({
  tier,
  stripeReady,
  monthlyLabel,
  annualLabel,
  annualPerMonth,
  savings,
}: {
  tier: 'free' | 'plus';
  stripeReady: boolean;
  monthlyLabel: string;
  annualLabel: string;
  annualPerMonth: string;
  savings: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);

    try {
      if (stripeReady) {
        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const data = (await response.json()) as { url?: string; error?: { message?: string } };
        if (!response.ok || !data.url) throw new Error(data.error?.message ?? 'Checkout failed');
        window.location.href = data.url;
        return;
      }

      const response = await fetch('/api/billing/dev-upgrade', { method: 'POST' });
      if (!response.ok) throw new Error('Development upgrade is disabled here');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    await fetch('/api/billing/dev-upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cancel: true }),
    });
    router.refresh();
    setBusy(false);
  }

  if (tier === 'plus') {
    return (
      <div className="mt-6">
        <div className="rounded-[var(--radius-xl)] border border-[rgba(124,92,252,0.3)] bg-[var(--color-viola-soft)] px-5 py-4 text-center">
          <p className="text-[15px] font-semibold text-white">You&rsquo;re on Viola Plus</p>
        </div>
        {!stripeReady && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="mt-3 w-full text-[12px] text-[var(--color-text-tertiary)] hover:text-white"
          >
            Cancel (development)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3">
        <PlanCard
          active={plan === 'annual'}
          onClick={() => setPlan('annual')}
          label="Yearly"
          price={annualPerMonth}
          detail={annualLabel}
          badge={`Save ${savings}%`}
        />
        <PlanCard
          active={plan === 'monthly'}
          onClick={() => setPlan('monthly')}
          label="Monthly"
          price={monthlyLabel}
          detail="Billed monthly"
        />
      </div>

      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className="mt-4 w-full rounded-full bg-[var(--color-viola)] px-5 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-45"
      >
        {busy ? 'One moment…' : stripeReady ? 'Get Viola Plus' : 'Unlock Plus (development)'}
      </button>

      {!stripeReady && (
        <p className="mt-2.5 text-center text-[12px] text-[var(--color-warning)]">
          No Stripe keys configured — this grants Plus locally so the tier is testable.
        </p>
      )}

      {error && <p className="mt-3 text-center text-[13px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function PlanCard({
  active,
  onClick,
  label,
  price,
  detail,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  price: string;
  detail: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'relative rounded-[var(--radius-lg)] border px-4 py-4 text-left transition-all',
        active
          ? 'border-[var(--color-viola)] bg-[var(--color-viola-soft)]'
          : 'border-[var(--color-hairline)] bg-[var(--color-surface)] hover:border-[var(--color-hairline-strong)]',
      ].join(' ')}
    >
      {badge && (
        <span className="absolute -top-2 right-3 rounded-full bg-[var(--color-viola)] px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] text-white uppercase">
          {badge}
        </span>
      )}
      <span className="block text-[13px] text-[var(--color-text-secondary)]">{label}</span>
      <span className="stat mt-1 block text-[19px] text-white">{price}</span>
      <span className="mt-0.5 block text-[12px] text-[var(--color-text-tertiary)]">{detail}</span>
    </button>
  );
}
