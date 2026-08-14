# Viola

**Post your fit, and _voilà_: every piece identified, scored, and shoppable.**

Upload a mirror selfie. Viola identifies each garment, finds the real product
(clean catalogue image, price, where to buy), lays it out around your photo,
gives the outfit a **Viola Score** and a **Vibe**, and hands you a one-tap card
to fire into Messages.

Web app (Next.js) + iOS app (Expo), one shared TypeScript core.

---

## Quick start

```bash
pnpm install
pnpm verify   # format check + typecheck + lint + test
pnpm dev
```

**No API keys are required.** Every external service sits behind a provider
interface with a mock implementation backed by committed fixtures, so the whole
app builds, runs and tests offline. Add keys to `.env` and flip
`VIOLA_PROVIDERS=live` (or one provider at a time) when you have them.

The database is the same story: with no `DATABASE_URL` set, dev and tests run
against an in-process **PGlite** instance — real PostgreSQL 18, no Docker.

## Layout

| Path                | What                                                            |
| ------------------- | --------------------------------------------------------------- |
| `apps/web`          | Next.js app + the single API used by both clients               |
| `apps/mobile`       | Expo / iOS                                                      |
| `packages/core`     | Domain types, zod schemas, API client, analytics catalogue      |
| `packages/db`       | Drizzle schema, migrations, repositories, PGlite harness        |
| `packages/pipeline` | Vision / product / affiliate / storage providers + orchestrator |
| `packages/render`   | Server-side share-card renderer (satori + resvg)                |
| `packages/design`   | Design tokens — single source of truth for both platforms       |

## Docs

See `docs/` for architecture, provider setup, design language and the runbook.
