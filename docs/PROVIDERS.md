# Going live

Everything below is optional. The app is fully functional with none of it —
mock providers, an in-process database, and a seeded feed. Add integrations one
at a time; each is independent.

Set `VIOLA_PROVIDERS=live` to switch everything, or flip a single provider with
its own variable. A live provider whose key is missing logs a warning and falls
back to its mock rather than crashing.

---

## 1. Vision — naming the garments

The only thing in the product that genuinely cannot be done locally. A local
model can tell you "shoe"; it cannot tell you "HOKA Skyward X".

1. Get a key from Google AI Studio.
2. Set:

```bash
GEMINI_API_KEY=...
GEMINI_VISION_MODEL=gemini-flash-latest   # optional
VIOLA_VISION_PROVIDER=live
```

Flash-class models are the right call here: native JSON-schema structured
output, normalised bounding boxes, and roughly **$1.60 per 1000 images**, which
is what makes the per-look economics work at all.

**Do not soften two instructions in the prompt.** It demands a null brand
rather than a guess — a hallucinated brand is the fastest way to destroy trust
in the whole card — and it asks the model to score generously. There is a test
asserting the no-guessing rule survives prompt edits.

## 2. Product search — where to buy

```bash
SERPAPI_API_KEY=...
VIOLA_PRODUCT_PROVIDER=live
```

SerpApi's `google_shopping` engine returns the retailer, price, product link and
the clean catalogue thumbnail. That thumbnail matters more than it sounds: it is
what lets a card show a floating product cutout instead of a crop of a blurry
mirror selfie.

250 free searches a month, then $25/mo. **SearchApi** is cheaper at volume
($25 per 10,000) and drops into the same interface if you outgrow it.

Thumbnails are hotlinked from Google's CDN and expire, so the imagery stage
re-hosts every one into your own storage before anything renders.

### Visual search: look-alikes, dupes, and unbranded items

Text search only works when a logo was visible, which covers a minority of real
outfits. Searching "white crop top" returns ten thousand white crop tops and
none of them are hers.

Visual search answers the other question — "find things that look like THIS" —
using the same SerpApi key via the Google Lens engine:

- `exact_matches` → where to buy the actual item
- `visual_matches` → look-alikes and cheaper dupes, with prices

As of August 2026 SerpApi accepts **direct image upload** via `image_id`, so a
garment cutout never has to be published to a public URL first. That matters
here: it avoids putting a crop of someone's photo on the open internet just to
search with it.

**The segmentation output is the query.** Feeding the whole photo to a reverse
image search returns "woman standing in front of a green wall". Feeding an
isolated cutout of the trousers returns trousers. The sticker work is not just
decoration — it is what makes visual search usable.

The pipeline picks per garment (`packages/pipeline/src/matching.ts`):

| Situation             | Strategy                            | Lookups |
| --------------------- | ----------------------------------- | ------- |
| Logo visible + cutout | text for the pick, visual for dupes | 2       |
| No logo, has cutout   | visual for everything               | 1       |
| No usable cutout      | text only, results will be vague    | 1       |

Visual runs even on a branded item, because "where else, cheaper" is a question
text search cannot answer, and it is the reason anyone opens the dupes rail.

**Alternatives considered.** Bing Visual Search is $10–15 per 1,000. Syte is
fashion-specific and by far the most accurate for apparel — it understands
sleeve length, silhouette and pattern rather than generic image similarity —
but it is enterprise-priced in the low-to-mid five figures a year. ViSenze
starts around $99/month. Lens is the right call at this stage purely because it
reuses one key and one account; Syte is the upgrade path if visual match
quality becomes the thing limiting conversion.

## 3. Affiliate — the commission

This is the "one solution that includes everything" answer.

**Sovrn //Commerce** (formerly VigLink): a single account covering 50,000+
merchants — Nike, adidas, ASOS, H&M, Macy's, Ralph Lauren, Saks, Amazon and so
on — with **no per-merchant applications**. CPC programmes approve in about 24
hours and signup is free.

```bash
SOVRN_API_KEY=...
VIOLA_AFFILIATE_PROVIDER=live
```

### Why Sovrn and not Skimlinks

Skimlinks has comparable reach and better negotiated rates, but it monetises by
**rewriting links with JavaScript in a rendered page**. That does nothing for a
native iOS app, and nothing for a server-rendered product card. Sovrn's Redirect
API is a plain server-side URL construction, which works everywhere we need it.

Skimlinks is a reasonable phase-two A/B once there is web traffic to test on.

### You can launch without any of this

`NoopAffiliateProvider` is a legitimate production configuration, not a
placeholder. Links go straight to the retailer, clicks are still recorded in
`affiliate_clicks`, and the product is complete. When an account is approved,
set one variable — no stored links change, because every outbound tap already
goes through our own `/go/:id` redirector.

That redirector exists for three reasons: the network stays swappable, we own
the click analytics regardless of provider, and attribution survives iOS
stripping client-side URL parameters.

### Reconciliation

Sovrn's Transactions API returns revenue events carrying the tracking id we
minted, so commission attributes back to a specific look and item. Payouts are
net-90.

## 4. Storage

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=viola
VIOLA_STORAGE_PROVIDER=live
```

Without this, uploads and generated cards live under `.viola-storage/` and are
served by `/api/media`.

## 5. Database

```bash
DATABASE_URL=postgresql://...
```

Any Postgres works. Apply migrations with `pnpm --filter @viola/db migrate`.
Without it, an on-disk PGlite instance is used and seeded automatically.

## 6. Payments

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ANNUAL=price_...
```

Point the webhook at `/api/billing/webhook` and subscribe to
`checkout.session.completed` and the `customer.subscription.*` events.

Until a key is set, `/plus` offers a clearly-labelled development upgrade so the
paid tier is testable. It refuses outright once Stripe is configured or
`NODE_ENV=production`, guarded at both the route and the service.

**iOS must use StoreKit.** Apple requires in-app purchase for digital features
consumed in the app, and Viola Plus is one. Affiliate commerce is unaffected —
physical goods consumed outside the app must _not_ use IAP (guideline 3.1.3(e)),
so outbound shop links stay exactly as they are.

## 7. Email

```bash
RESEND_API_KEY=...
```

Until this is set, sign-in codes are returned to the client and logged, so the
auth flow works offline. **The moment a provider is configured this stops** —
the route checks before including the code in a response.

## 8. Moderation

```bash
VIOLA_MODERATOR_EMAILS=you@example.com,someone@example.com
```

Unlocks `/moderation`. With none set the page 404s: a moderation console that
fails open is worse than not having one.

## 9. Other

```bash
VIOLA_GUEST_SECRET=            # openssl rand -base64 32 — signs guest cookies
NEXT_PUBLIC_APP_URL=           # used for share links and OG image URLs
VIOLA_FREE_WEEKLY_LOOKS=5      # free tier AI taggings per week
VIOLA_DAILY_SPEND_CAP_CENTS=2000
NEXT_PUBLIC_POSTHOG_KEY=
SENTRY_DSN=
```

Set `VIOLA_GUEST_SECRET` before any real traffic. The development fallback is
a fixed string, which would let anyone forge a guest id and stuff bloom counts.
