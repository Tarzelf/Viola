import { EarlyHero, InviteRedeem, WaitlistForm } from '@/components/waitlist-form';

export const metadata = {
  title: 'Early access',
  description: 'Request early access to Viola — post your fit, and voilà.',
};

export default function EarlyAccessPage() {
  return (
    <div className="min-h-dvh px-4 pb-20">
      <EarlyHero />
      <WaitlistForm />
      <InviteRedeem />
    </div>
  );
}
