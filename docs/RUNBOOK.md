# Runbook

## Local development

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

That is the whole setup. No Docker, no database to provision, no API keys. On
first boot the app creates a PGlite database under `apps/web/.viola-db`,
applies migrations, seeds twelve looks and generates their artwork — so you land
on a populated feed rather than an empty state.

Sign in with any email address; the six-digit code is printed in the terminal
and shown on screen while no email provider is configured.

## Checks

```bash
pnpm verify         # format + typecheck + lint + test  (the CI gate)
pnpm test
pnpm typecheck
```

## Useful commands

```bash
pnpm --filter @viola/pipeline demo   # a full look, offline, ~220ms
pnpm --filter @viola/render demo     # writes the three share cards to .demo/
pnpm --filter @viola/db seed
pnpm --filter @viola/db generate     # regenerate SQL after a schema change
pnpm --filter @viola/design generate # regenerate theme.css after a token change
```

## Resetting local state

```bash
rm -rf apps/web/.viola-db apps/web/.viola-storage
```

Next boot re-seeds from scratch.

## Gotchas that will cost you an hour

**The dev server does not reliably hot-reload changes inside `packages/*`.**
After editing a workspace package, hard restart:

```bash
kill <pid>; rm -rf apps/web/.next; pnpm dev
```

Symptom: you fix something, the fix is clearly correct, and the running app
behaves as though you never made it.

**Never add `.js` extensions to relative imports.** Turbopack cannot resolve
them in workspace packages and silently produces a module with no exports at
all. All internal imports are extensionless.

**A function exported from a `'use client'` file cannot be _called_ from a
server component** — only rendered as a component. Shared helpers go in
`lib/format.ts` or similar.

**Never require a Postgres extension in a migration.** PGlite has no `pgcrypto`;
`gen_random_uuid()` is built in and sufficient. A test enforces this.

**`@resvg/resvg-js` is a native binding.** Any route rendering a card needs
`export const runtime = 'nodejs'`.

## Deploying

1. Provision Postgres, set `DATABASE_URL`, run `pnpm --filter @viola/db migrate`.
2. Set `VIOLA_GUEST_SECRET` — the development fallback is a fixed string, and
   leaving it would let anyone forge a guest id and stuff bloom counts.
3. Set `NEXT_PUBLIC_APP_URL` so share links and OG images resolve.
4. Add providers as you get them — see `PROVIDERS.md`. None are required.
5. Set `VIOLA_MODERATOR_EMAILS` so somebody can actually action reports.

Cards are rendered with native bindings, so the app needs the Node runtime.
Edge will not work for the routes that render images.

## Watching the right things

The viral funnel is six steps, and loops die at whichever step nobody is
watching:

```
share_trigger_reached → share_opened → share_sent
  → share_link_opened → guest_activated → referred_signup_completed
```

Optimise the _weakest_ step, not the average — they multiply. Benchmarks for
consumer apps: K of 0.15 is the floor worth measuring, 0.25 acceptable, 0.4 good.
Launch target is 0.35.

Cycle time matters more than raw K. A K of 0.5 with a one-day loop beats a K of
0.9 with a thirty-day one, which is why the share CTA fires at the reveal rather
than living in a menu.

## Cost

Roughly **$0.027 per look** — one vision call plus a few product searches. Watch:

- product cache hit rate (should climb steadily as popular items recur)
- `usage_quota` for accounts near the weekly cap
- `spend_ledger` against `VIOLA_DAILY_SPEND_CAP_CENTS`

If per-look cost is not falling as the catalogue warms up, query normalisation
has probably regressed and the cache is missing.
