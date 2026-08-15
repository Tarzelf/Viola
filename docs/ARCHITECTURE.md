# Architecture

## The shape of it

```
apps/web            Next.js 16 — the site and the single API used by both clients
apps/mobile         Expo / iOS (not yet built)
packages/core       Domain types, zod schemas, scoring, archetypes, analytics catalogue
packages/db         Drizzle schema, migrations, PGlite test harness, seed
packages/pipeline   Providers + orchestrator + layout engine + local imagery
packages/render     Server-side share-card renderer (satori + resvg)
packages/design     Design tokens — single source of truth for web and native
```

The API lives in the Next app rather than in Supabase Edge Functions. One
language, one deploy, and the same zod schemas validate on the server and in
both clients. Supabase is used for what it is genuinely good at — Postgres,
auth storage, object storage — and nothing else.

## Everything runs with no keys

This is a hard constraint, not a convenience. Every external dependency sits
behind a provider interface with a mock implementation backed by committed
fixtures, so a fresh clone runs the complete product offline and CI exercises
the whole pipeline for free.

| Provider                | Mock                                         | Live                                        |
| ----------------------- | -------------------------------------------- | ------------------------------------------- |
| `VisionProvider`        | Fixture outfits, deterministic per image     | Gemini Flash, JSON-schema structured output |
| `ProductSearchProvider` | Local catalogue, deliberately messy results  | SerpApi Google Shopping                     |
| `AffiliateProvider`     | Noop — links go direct, clicks still tracked | Sovrn Commerce Redirect API                 |
| `StorageProvider`       | Local filesystem / in-memory                 | Supabase Storage                            |

Selection is per-provider via env, so you can go live one integration at a time.
A live provider whose key is missing warns and falls back rather than crashing —
half a product beats a boot loop.

The database follows the same rule: with no `DATABASE_URL`, dev and tests run on
**PGlite**, which is real PostgreSQL 18 compiled to wasm, in-process. No Docker.

> **Never require a Postgres extension in a migration.** PGlite has
> `gen_random_uuid()` built in but has no `pgcrypto`. Requiring it would put
> Docker back in the dev loop and break CI. A test asserts no migration contains
> `create extension`.

## The pipeline

`POST /api/looks` returns a slug as soon as the row exists; the pipeline runs
after the response and writes results as each stage completes, so the client can
animate pieces in one at a time.

| Stage     | What happens                                             | Local? |
| --------- | -------------------------------------------------------- | ------ |
| `ingest`  | Downscale, **strip EXIF/GPS**, re-encode, store          | yes    |
| `vision`  | Identify garments, bboxes, style tags, score, safety     | **no** |
| `resolve` | Product search per item, ranked, cached globally         | **no** |
| `imagery` | Fetch catalogue image, trim, remove white bg, re-host    | yes    |
| `layout`  | Subject band, energy map, gutter placement, leader lines | yes    |
| `render`  | Story / square / OG cards                                | yes    |

Only two stages need the network. Naming a brand from a photo and finding where
to buy it genuinely require an API; everything that makes the card _look_ the
way it does is free and offline.

### Graceful degradation is the governing rule

A stage that fails must never cost the user their look.

- Product search dies → items still get labels and cards, with no buy links.
- A cutout 404s → the card degrades to a text label.
- Nothing clears the confidence bar → the item shows with no price.
- Vision flags the upload → quarantined, and no paid API is called at all.

There are tests for each of those paths. The alternative, all-or-nothing, means
one flaky retailer thumbnail turns into a failed upload.

### Cost control

Roughly one vision call plus a few product searches per look — about $0.027.
Three mechanisms keep that bounded:

1. **A global product cache** keyed by normalised query hash. A viral sneaker
   resolves once for everyone, not once per look. `HOKA Skyward X — Blue!` and
   `hoka skyward x blue` hash identically.
2. **A weekly per-user quota**, checked _before_ any paid API is touched.
3. **A per-look search budget**, so one busy outfit cannot run away.

## The layout engine

Runs entirely locally, about 10ms.

1. **Subject band** = the union of the vision bounding boxes, dilated 3%.
2. **Energy map** = Sobel on a 96×171 greyscale raster.
3. **Gutters** = the space either side of the subject, if wide enough.
4. **Placement** = lowest-cost non-overlapping slot, where
   `cost = busyness + vertical drift + side balance`.
5. **Leader lines** = an L from the card edge across and down to the garment.

> **Do not detect the subject with column edge energy.** It was tried and it
> fails: energy peaks at the _silhouette boundary_, not across the body, because
> a flat dark torso has almost no internal gradient. It returned 0.427–0.510 for
> a subject actually spanning 0.313–0.487. The bbox union returns 0.290–0.530,
> costs nothing extra, and there is a regression test guarding it.

The balance term is what makes cards flank the subject instead of stacking down
one edge. Top and bottom safe zones keep cards clear of the score pill; that
costs two slots of capacity and is worth it.

## Rendering

satori builds an SVG element tree, resvg rasterises it. No Chrome, no Puppeteer,
no Docker. A 1080×1920 story card takes about 400ms.

`@resvg/resvg-js` is a native binding, so **any route that renders a card must
use the Node runtime, not Edge.**

The OG card is a _different composition_ from the story card — photo left,
summary panel right. Cover-fitting a portrait selfie into a landscape frame
crops everything below the shoulders and leaves every leader line pointing
nowhere. A link preview is read at thumbnail size in a message thread; faithfully
miniaturising the story card optimises for the wrong thing.

## Identity

Two kinds of viewer, and the guest is not an afterthought.

- **Guests** get an HMAC-signed device id. They can view, bloom and shop with no
  account. This is the single biggest lever on the viral coefficient — an auth
  wall is the most expensive step you can put in a loop.
- **Accounts** sign in with a six-digit email code. Sessions are rows in the
  database, not self-describing cookies, so sign-out actually revokes and
  deletion can terminate every device at once.

On sign-up, everything the guest did — blooms, affiliate clicks — is **claimed**
onto the new account. Losing it at the moment someone converts would be a strange
reward for converting.

## What is gated

The paywall sits only on **accumulation**: vaults, saved items, weekly taggings,
and removing sponsored posts. Posting, blooming, viewing and sharing are free and
stay free, because they are the growth engine. There is a test asserting the
entitlement set contains no `canPost` / `canBloom` / `canShare` flag, so nobody
adds one by accident.
