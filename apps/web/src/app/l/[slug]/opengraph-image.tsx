import { getArchetype } from '@viola/core';
import { renderLookCard } from '@viola/render';
import { getLookBySlug } from '@/lib/queries';
import { providers } from '@/lib/providers';

/**
 * The link preview image.
 *
 * This is the single most-seen artefact the product produces: it is what
 * renders in a message thread when someone shares a look, and it decides
 * whether the recipient taps. Rendered server-side with satori and resvg.
 *
 * Node runtime is mandatory — @resvg/resvg-js is a native binding and sharp is
 * used to prepare the photo, neither of which run on Edge.
 */
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A look on Viola';

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const look = await getLookBySlug(slug);

  if (!look) {
    return new Response('Not found', { status: 404 });
  }

  const storage = providers().storage;

  // Serve the pre-rendered card when the pipeline already produced one. Link
  // previews are fetched by crawlers with short timeouts, so paying the render
  // cost again on every scrape would be both slow and wasteful.
  if (look.ogCardPath) {
    const cached = await storage.get(look.ogCardPath);
    if (cached) {
      return new Response(new Uint8Array(cached), {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  const photo = await storage.get(look.photoPath);
  if (!photo) return new Response('Not found', { status: 404 });

  const items = await Promise.all(
    look.items.map(async (item, index) => ({
      index,
      brand: item.brand,
      title: item.title,
      subtype: item.subtype,
      priceCents: item.priceCents,
      cutout: item.imagePath ? await storage.get(item.imagePath) : null,
    })),
  );

  const archetypeName = look.archetypeId
    ? (getArchetype(look.archetypeId)?.name ?? 'A look')
    : 'A look';

  const card = await renderLookCard({
    variant: 'og',
    photo,
    items,
    layout: look.layout ?? { subject: { x0: 0.3, x1: 0.7 }, slots: [], unplaced: [] },
    archetypeName,
    score: look.score ?? 0,
    handle: look.handle,
    eyebrow: `@${look.handle} wants you to rate this`,
  });

  return new Response(new Uint8Array(card.png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
    },
  });
}
