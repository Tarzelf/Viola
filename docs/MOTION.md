# Viola motion map

Source of truth for product motion: [transitions.dev](https://transitions.dev) skill
installed at `.agents/skills/transitions-dev` (+ polish companion).

Viola keeps its own brand springs in `@viola/design` (`--ease-gentle`,
`--ease-bouncy`, `--duration-reveal`). transitions.dev recipes are layered on
top for the moments that matter to the viral loop.

## Audit → apply

| Surface | File | Recipe | Status |
|---|---|---|---|
| Item cards rising during Voilà | `look-card.tsx`, `upload-flow.tsx` | texts-reveal distances + `viola-rise` | Applied (blur/distance tokens) |
| Score digits landing | `look-card.tsx`, `upload-flow.tsx` | **number-pop-in** | Applied |
| Processing headline | `upload-flow.tsx` | **texts-reveal** + **shimmer-text** | Applied |
| Bloom tap celebration | `bloom-button.tsx` | **like-button** (violet) | Applied |
| Account menu | `account-menu.tsx` | **menu-dropdown** | Applied |
| Look gallery lightbox | `look-gallery.tsx` | **modal open/close** | Applied |
| Paywall sheet | `paywall.tsx` | modal | Deferred (works; not the loop) |
| Feed tab pills | `page.tsx` | tabs-sliding | Deferred (chrome) |
| OTP / DELETE errors | sign-in, danger-zone | error-shake | Deferred |

## Rules for future agents

1. Install/read `.agents/skills/transitions-dev/SKILL.md` before inventing keyframes.
2. Prefer `var(--digit-*)`, `var(--like-*)`, `var(--stagger-*)`, `var(--modal-*)`, `var(--dropdown-*)` over new hardcoded ms.
3. Bloom color is `--color-viola`, never the library pink.
4. Always keep `@media (prefers-reduced-motion: reduce)` guards.
5. Do not motion-polish seed silhouettes — content quality first.

## Installed CSS

`apps/web/src/app/transitions.css` — curated subset imported from `globals.css`.
