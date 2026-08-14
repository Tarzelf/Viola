import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SignInForm } from '@/components/sign-in-form';
import { getViewer } from '@/lib/identity';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const viewer = await getViewer();
  if (viewer.isAuthenticated) redirect(next ?? '/');

  return (
    <AppShell>
      <div className="pt-10">
        {/* Only relative paths are honoured, so a crafted ?next= cannot bounce
            someone off-site after they authenticate. */}
        <SignInForm next={next?.startsWith('/') ? next : '/'} />
      </div>
    </AppShell>
  );
}
