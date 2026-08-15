import type { Metadata } from 'next';
import { getViewer } from '@/lib/identity';
import { getFoldLattice } from '@/lib/fold';
import { track } from '@/lib/analytics';
import { FoldExperience } from '@/components/fold/fold-experience';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fold',
  description: 'Every look, every path, folded into one room.',
};

export default async function FoldPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const viewer = await getViewer();
  const lattice = await getFoldLattice({ viewerUserId: viewer.userId });

  track('fold_opened', {
    surface: 'web',
    momentCount: lattice.moments.length,
    ...(focus ? { focusSlug: focus } : {}),
    ...(viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId }),
  });

  return <FoldExperience lattice={lattice} focusSlug={focus ?? null} />;
}
