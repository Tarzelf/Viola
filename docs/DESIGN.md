# Design language — "Petal & Pavement"

## The tension, and the rule that resolves it

The brief asked for two things that sound opposed: _"girly, super cute"_ and
_"Apple, Ferrari, Lululemon — premium, clean"_.

> **The chrome is premium and restrained. The delight lives in motion, copy and
> one saturated accent — never in clutter.**

A near-black canvas, generous space, hairline borders, precise type. Then the
cute arrives in the spring animations, the bloom burst, the archetype names and
the micro-copy. That is how Lululemon and Ferrari manage to feel expensive _and_
energetic at once — the restraint is what buys the energy its impact.

Every token lives in `packages/design/src/tokens.ts`. Nothing else may hardcode a
colour or a radius.

## Colour

| Token              | Value                 | Use                                                 |
| ------------------ | --------------------- | --------------------------------------------------- |
| `ink`              | `#0B0A0F`             | The canvas. Near-black with a faint violet cast     |
| `surface`          | `#141220`             | Cards, sheets                                       |
| `paper`            | `#FBF9FB`             | Warm off-white                                      |
| **`viola`**        | **`#7C5CFC`**         | **The one accent.** CTAs, score pill, blooms, focus |
| `orchid` / `blush` | `#E9A9FF` / `#FFB4C8` | **Gradients and glows only**                        |
| `gold`             | `#E8C878`             | **Top of the Week and nothing else**                |

The guardrails on orchid, blush and gold are enforced by tests, because these are
exactly the decisions that erode one careless commit at a time. Soft pink as a
button fill is how "premium" becomes "cheap".

Shadows are violet glows, never grey drop shadows. On a near-black canvas a grey
shadow reads as dirt; a violet glow reads as light.

## Type

- **Instrument Serif** — display. Archetype names, editorial moments. This is
  what makes the product read as fashion rather than as a dashboard.
- **Geist Sans** — all UI.
- **Geist Mono** — scores, prices, counts.

All OFL, vendored, and used identically by the web app and the server-side card
renderer. A share card whose type does not match the page it came from is a
subtle but corrosive inconsistency.

### The signature

```
HOKA
SKYWARD X BLUE
```

ALL CAPS, small, ~3px letter-spacing. That single typographic choice is most of
why the reference layout looks expensive, so it is a first-class token
(`type.itemLabel`) with a test asserting its tracking, size and weight.

## Motion

Springs only. No linear easing anywhere — it is the fastest way to make an
interface feel cheap.

The reveal choreography, in order: photo settles → cutouts stagger in at 520ms
intervals → score pill lands → hold, then navigate.

**The pacing runs on the client's clock, not on data arrival.** Against mock
providers the pipeline finishes in ~200ms, so pieces all appeared at once —
correct, and completely flat. A fast backend should make the reveal _smooth_,
not skip it. This is the one genuinely delightful moment the product has.

`prefers-reduced-motion` is respected globally.

## Nomenclature

Chosen for the persona, and changing any of these touches everything.

| Thing       | Name                       | Why                                                                |
| ----------- | -------------------------- | ------------------------------------------------------------------ |
| A post      | **Look**                   | What the audience already calls it                                 |
| Upvote      | **Bloom**                  | On-brand with the violet flower, warm, and positive-only           |
| Folder      | **Vault**                  | Reads as private and worth keeping. A closet is where laundry goes |
| Rating      | **Viola Score** + **Vibe** | The archetype leads; the number supports                           |
| Leaderboard | **Top of the Week**        | Top only. There is deliberately no inverse                         |
| The lattice | **Fold**                   | Every look at once. Moments, scenarios, ways back                  |

## The anti-comparison thesis

This is a design constraint, not a nicety. 59% of the target audience report
feeling worse after using social media, and comparison is the mechanism.

- **Upvotes only. No downvotes.** Ever.
- **The archetype is the headline, the number is supporting cast.** A name
  invites identity; a number invites ranking. `scoreHeadline()` enforces the
  ordering and a test asserts it.
- **Scores are compressed into 62–99 with a hard floor.** There is no failing
  grade, and a test asserts no band name is pejorative. The app exists to make
  someone feel good about what they already put on.
- **Views and Blooms are the only public counters**, and both only ever go up.
- **Follower counts are stored but never shown on a profile header.**
- **Top of the Week has no opposite.** A public ranking of the lowest-scoring
  looks would be actively harmful to the people this is built for.

## Voice

Confident, short, a little playful. "Voilà." · "you ate." · "1.2k blooms."

No emoji in the chrome. Emoji belong in user content and share messages, where
a person chose them.
