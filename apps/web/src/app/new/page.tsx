import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { UploadFlow } from '@/components/upload-flow';
import { getViewer } from '@/lib/identity';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Post a fit' };

export default async function NewLookPage() {
  const viewer = await getViewer();

  // Viewing and blooming stay open to everyone — that is the growth loop. But
  // a look has to belong to an account, so posting is the one place we ask.
  if (!viewer.isAuthenticated) redirect('/signin?next=/new');

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[560px]">
        <UploadFlow />
      </div>
    </AppShell>
  );
}
