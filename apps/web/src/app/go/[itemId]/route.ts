import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { providers } from '@/lib/providers';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * The outbound redirector.
 *
 * Every shop tap goes through here before reaching the retailer. Three reasons,
 * all of which matter more than the extra hop costs:
 *
 * 1. **The affiliate network becomes swappable.** Launch runs the Noop provider
 *    — links go direct and nothing is monetised — and switching to Sovrn later
 *    is one environment variable, with no change to any stored link.
 * 2. **We own the click data** regardless of which network is active, so
 *    commission can be attributed back to a specific look and item.
 * 3. **Attribution survives iOS**, which strips client-side URL parameters. The
 *    tracking id is minted server-side and handed to the network directly.
 *
 * On any failure the shopper still reaches the retailer. A broken shop button
 * is far worse than an unmonetised one.
 */
export async function GET(request: Request, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  const url = new URL(request.url);
  const lookSlug = url.searchParams.get('l');

  const database = await db();

  const [row] = await database
    .select({
      itemId: schema.lookItems.id,
      lookId: schema.lookItems.lookId,
      productId: schema.products.id,
      merchantUrl: schema.products.merchantUrl,
    })
    .from(schema.lookItems)
    .leftJoin(schema.products, eq(schema.products.id, schema.lookItems.productId))
    .where(eq(schema.lookItems.id, itemId))
    .limit(1);

  if (!row?.merchantUrl) {
    return NextResponse.redirect(new URL(lookSlug ? `/l/${lookSlug}` : '/', request.url));
  }

  const viewer = await getViewer();
  const affiliate = providers().affiliate;
  const trackingId = `vc_${randomBytes(12).toString('base64url')}`;

  let targetUrl = row.merchantUrl;
  try {
    targetUrl = await affiliate.wrap({ merchantUrl: row.merchantUrl, trackingId });
  } catch {
    // Resilient provider already handles this, but never let a wrapping failure
    // stop someone reaching the shop.
    targetUrl = row.merchantUrl;
  }

  const hash = (value: string | null) =>
    value ? createHash('sha256').update(value).digest('base64url').slice(0, 32) : null;

  try {
    await database.insert(schema.affiliateClicks).values({
      lookItemId: row.itemId,
      lookId: row.lookId,
      productId: row.productId,
      userId: viewer.userId,
      guestId: viewer.userId ? null : viewer.guestId,
      provider: affiliate.name,
      targetUrl,
      merchantUrl: row.merchantUrl,
      trackingId,
      // Hashed, never raw. These exist for abuse detection only.
      ipHash: hash(request.headers.get('x-forwarded-for')),
      userAgentHash: hash(request.headers.get('user-agent')),
    });
  } catch {
    // Analytics must never block commerce.
  }

  track('shop_tapped', {
    surface: 'web',
    lookId: row.lookId ?? '',
    lookItemId: row.itemId,
    affiliateProvider: affiliate.name,
    ...(viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId }),
  });

  return NextResponse.redirect(targetUrl, { status: 302 });
}
