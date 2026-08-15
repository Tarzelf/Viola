# The Fold

A look is five things a phone cannot show at once: **when** it was worn, **what
vibe** it is, how much **energy** it is carrying, which **pieces** it shares
with other closets, and **whose telling** of the fit this is.

The Fold is how those extra dimensions become a room.

## The two pictures it is built from

In _Interstellar_, future humans fold Cooper's moments with Murph out of a
5-space he cannot inhabit and into a tesseract he can walk — the same bedroom,
every instant, every attempt, visible at once.

In _Pantheon_, Maddie spends a civilisation's worth of energy running
simulations until she finds a way back through time. The energy is not a score.
It is the thing that lights a path home.

Viola does the same job for outfits.

- A **moment** is a look: one person, one fit, one time.
- A **scenario** is a path a piece takes from closet to closet — the Sambas on
  Noor on Tuesday and on Priya on Friday are the same object moving through
  the lattice.
- A **return** is a way back: the histories that can walk to the look you are
  standing in, ranked by how much energy they carry, not by how short they are.

## What is computed

`packages/core/src/fold.ts` is the whole model. No renderer, no database.

| Dimension | Source                                   | Folded into      |
| --------- | ---------------------------------------- | ---------------- |
| time      | `publishedAt`                            | the _w_ axis     |
| vibe      | archetype                                | angle in _x/z_   |
| energy    | score + blooms + piece count             | height, and glow |
| kinship   | shared brands / product ids              | radius           |
| scenario  | whose closet + a stable hash of the look | a small orbit    |

Those five numbers become a point in 4-space. A tesseract rotation (the
`xw` / `yw` / `zw` planes) mixes time into ordinary space. A perspective
projection from 4-space to 3-space is the room you turn.

Dragging the Fold is not orbiting a camera around a sculpture. It is turning
the extra dimensions so another slice of time becomes a wall you can see.

## Surfaces

| Surface   | Where                                  | What you get                                   |
| --------- | -------------------------------------- | ---------------------------------------------- |
| Web room  | `/fold`                                | WebGL tesseract, photo-panes, energy filaments |
| Web map   | `/fold` when motion is reduced / no GL | The same lattice, flattened                    |
| iOS       | `Fold` from the feed or a look         | The flattened lattice, same math               |
| Look page | "See this moment in the room"          | Opens the Fold focused on that look, in Return |
| Feed      | The editorial teaser                   | The door in                                    |

The native app talks to `GET /api/fold` and runs `foldLattice` / `returnPathsFor`
from `@viola/core`. There is one model.

## What it is not

It is not a ranking. Energy is how brightly a path lights, not a grade.

It is not a feed in 3D. The feed is for _now_. The Fold is for _all at once_.

It does not invent looks. Ghost scenarios (look-alikes that were never worn)
are a later door; v1 only folds what people actually posted.

## Reduced motion

`prefers-reduced-motion` turns the WebGL room into the flat map and stops the
tesseract from breathing. The data does not change. The fourth wall is simply
already open.
