import { AppShell } from '@/components/app-shell';
import { UploadFlow } from '@/components/upload-flow';

export const metadata = { title: 'Post a fit' };

export default function NewLookPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[560px]">
        <UploadFlow />
      </div>
    </AppShell>
  );
}
