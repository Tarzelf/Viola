import { redirect } from 'next/navigation';
import { PRICES, formatPrice } from '@viola/core';
import { AppShell } from '@/components/app-shell';
import { UpgradePanel } from '@/components/upgrade-panel';
import { getViewer } from '@/lib/identity';
import { db } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { isLiveWebBilling } from '@/lib/billing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Viola Plus' };

/**
 * Pricing.
 *
 * Everything listed is an extension of something the free tier already lets you
 * do. Nothing social is behind the paywall, and the page says so explicitly —
 * being upfront that posting and sharing stay free is more persuasive than
 * hiding it, and it is the honest description of the model.
 */
export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const viewer = await getViewer();
  if (!viewer.userId) redirect('/signin?next=/plus');

  const entitlements = await getEntitlements(await db(), viewer.userId);

  const monthly = PRICES.find((p) => p.id === 'monthly')!;
  const annual = PRICES.find((p) => p.id === 'annual')!;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[520px] pt-4">
        {welcome && entitlements.tier === 'plus' && (
          <div className="mb-6 rounded-[var(--radius-lg)] border border-[rgba(124,92,252,0.3)] bg-[var(--color-viola-soft)] px-4 py-3">
            <p className="text-[14px] text-white">
              You&rsquo;re on Viola Plus. Everything&rsquo;s unlocked.
            </p>
          </div>
        )}

        <p className="label-caps text-[var(--color-viola-text)]">Viola Plus</p>
        <h1 className="display mt-2 text-[38px] leading-[1.1] text-white">
          Keep everything you love
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Posting, blooming and sharing are free and always will be. Plus is for when one vault
          stops being enough.
        </p>

        <div className="surface mt-7 px-5 py-6">
          <ul className="flex flex-col gap-3.5">
            <Benefit
              title="Unlimited vaults"
              detail="Organise by season, mood, occasion — however you think."
            />
            <Benefit
              title="Unlimited saves"
              detail="The free plan keeps 20 pieces. Plus keeps everything."
            />
            <Benefit title="No sponsored posts" detail="A completely clean feed." />
            <Benefit title="Unlimited AI tagging" detail="Post as often as you like." />
            <Benefit title="Private looks" detail="Post something only you can see." />
            <Benefit
              title="Full score breakdown"
              detail="Fit, colour story, texture, statement, cohesion."
            />
          </ul>
        </div>

        <UpgradePanel
          tier={entitlements.tier}
          billingReady={isLiveWebBilling()}
          monthlyLabel={`${formatPrice(monthly.cents)}/month`}
          annualLabel={`${formatPrice(annual.cents)}/year`}
          annualPerMonth={`${formatPrice(annual.perMonthCents)}/mo`}
          savings={annual.savingsPercent}
        />

        <p className="mt-6 text-center text-[12px] leading-relaxed text-[var(--color-text-tertiary)]">
          Cancel any time. Buying something you found through Viola never costs extra — retailers
          pay us, not you.
        </p>
      </div>
    </AppShell>
  );
}

function Benefit({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-viola-soft)]">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12.5 10 17.5 19 7"
            stroke="var(--color-viola)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="block text-[13px] text-[var(--color-text-secondary)]">{detail}</span>
      </span>
    </li>
  );
}
