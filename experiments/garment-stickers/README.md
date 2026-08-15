# Spike: cutting garments out of a real photo as stickers

**Question.** Can we take a real outfit photo, discern the garments, turn them
into stickers, and assemble a shareable card — without an API key?

**Answer.** Yes for the stickers. No for the naming. Details below.

Not wired into the product. This exists so the finding is reproducible and the
decision is informed.

## Running it

```bash
cd experiments/garment-stickers
npm i @huggingface/transformers sharp
node build-card.mjs path/to/photo.jpg out.png
```

First run downloads ~100MB of model weights, then it is fully offline.
Segmentation takes about 2 seconds for a 1400×2100 photo.

## What was tried

### 1. Generic background removal — FAILED

`@imgly/background-removal-node` (U2Net). The obvious first reach, and it does
not work for this, because it removes the _background_ and keeps the whole
_person_. Cropping to a garment box and running it returns the garment plus
whatever skin, hair and neighbouring clothing shares that box.

The "t-shirt sticker" came back with a chin and a hand attached. Not close to
usable.

### 2. Semantic clothes segmentation — WORKS

`mattmdjaga/segformer_b2_clothes` via transformers.js. Trained to label
clothing regions specifically, so it separates a tee from the skin and hair
touching it. On the test photo it returned:

```
Background, Hair, Sunglasses, Upper-clothes, Face, Left-arm, Right-arm
```

Masking to the clothing labels gives a clean cutout: skin and hair gone,
garment intact.

## Tested on a proper full-body shot

The first test used a half-body outdoor portrait, which was not representative.
Re-run on a full-body studio shot — white crop top, striped wide-leg trousers,
red bag, white sneakers — the model returned:

```
Hair, Upper-clothes, Pants, Left-shoe, Right-shoe, Face, Left-arm, Right-arm, Bag
```

Four distinct products, cut cleanly, in 1.8 seconds. `screen.mjs` scores a
folder of candidate photos by how many garment categories each yields, which is
a fast way to find a representative test image.

Quality scales with how big the garment is in frame:

| Garment     | Source size | Result                                         |
| ----------- | ----------- | ---------------------------------------------- |
| Trousers    | 721×699     | excellent — the wide-leg shape is unmistakable |
| Bag         | 60×90       | good, clearly readable                         |
| Upper layer | 141×123     | usable, some colour bleed at the edge          |
| Shoes       | 97×39       | soft; has to be upscaled to read on a card     |

### Three bugs worth knowing about

**A hard min/max bounding box is wrong.** With the subject's feet apart, the
"shoe" mask spans both feet, so the box came back 817px across — nearly the
whole frame — and the sticker squashed to an unreadable sliver. Fixed by
isolating the largest connected region per mask, which boxes one actual shoe.
Percentile trimming was tried first and does not help: the pixels are genuinely
at both extremes rather than being scatter.

**Flood fill has to be iterative.** A recursive one overflows the stack on a
million-pixel mask.

**Arbitrary minimum sizes throw away real garments.** A 60px floor discarded
the shoes, which are legitimately about 90×40 in a full-body shot. The guard
should only catch specks of mask noise, and small garments need upscaling
rather than rejection.

## Why the first version looked cheap, and what fixed it

`sticker-v2.mjs` is a rewrite of the rendering. The originals looked bad for
four specific reasons, all fixed:

1. **The mask is hard binary 0/255**, so every edge was a jagged staircase.
   Now blurred and re-curved into a 1-2px antialiased edge.
2. **No erosion**, so a rim of background came along for the ride — the white
   crop top had a green halo from the wall behind it. The curve now sits above
   the midpoint, which pulls the boundary inward.
3. **The keyline was sized from SOURCE pixels.** A 721px garment got a thick
   outline, a 97px one got a hairline, and on the card — where both end up the
   same size — they looked like they came from different apps. Stickers are now
   normalised to a common size BEFORE the keyline is drawn, which is the only
   way to get consistency.
4. **Garments running off the frame** ended in a dead-straight mask edge, and
   the keyline traced it. Those are now detected and reported as `clipped`.

### Two sharp traps, both silent

Neither of these errors — they just produce a fully transparent sticker:

- **`.raw()` is mandatory.** Without it sharp encodes a PNG and the "mask
  values" read afterwards are file headers.
- **`blur()` promotes a 1-channel image to 3.** The buffer comes back three
  times the expected length, so every index into it is wrong. Force
  `.toColourspace('b-w')` before `.raw()`.

## It degrades with photo quality, and small items go first

`degrade.mjs` simulates phone-selfie conditions from a studio shot: 55%
resolution, dimmed and desaturated for indoor light, lifted blacks, slight
handshake blur, sensor noise and aggressive JPEG.

| Garment     | Studio           | Phone conditions                       |
| ----------- | ---------------- | -------------------------------------- |
| Trousers    | excellent        | still good — large garments are robust |
| Bag         | clean silhouette | silhouette breaks, gains a false notch |
| Upper layer | usable           | mushy                                  |
| Shoes       | soft             | barely recognisable                    |

The pattern is consistent: **the smaller the garment sits in frame, the sooner
it falls apart.** Shoes are the first casualty and also one of the most
shoppable categories in fashion, which is an awkward combination.

Worth being explicit that this is still a _simulation_. It reproduces
resolution, noise and lighting, but not a cluttered bedroom, a phone visible in
the mirror, or an awkward angle. A genuine amateur mirror selfie will be
harder than this.

## The catch: granularity

The taxonomy is **category-level, not item-level**. The test photo has a red
graphic tee _and_ a black jacket, and the model labels both as one
`Upper-clothes` region. It cannot tell you there are two garments there, and it
cannot separate them.

So a sticker is "the upper layer", not "the tee" and "the jacket".

## What this does and does not replace

Segmentation gives you a **picture of the actual garment**. It cannot give you
`HOKA Skyward X`, a price, or a link — no local model can read a brand off a
photo. That still needs the vision model.

The two approaches are complementary rather than competing:

|                            | Cut-out sticker | Catalogue image |
| -------------------------- | --------------- | --------------- |
| Needs an API key           | no              | yes             |
| Cost per look              | zero            | ~$0.027         |
| Shows the actual item worn | yes             | no              |
| Sharp enough to shop from  | no              | yes             |
| Granularity                | category        | per item        |

## Two gotchas that cost real time

**`dest-in` does not mask with a greyscale image.** It reads the _source's
alpha_, and a greyscale PNG is opaque everywhere, so compositing a mask that
way silently does nothing — you get the full rectangle back. The mask has to
_become_ the alpha channel. This bit twice: once masking the photo, once
building the sticker keyline, which rendered as a white box instead of hugging
the silhouette.

**`joinChannel` needs `removeAlpha()` first.** Joining a mask onto an already
RGBA image appends a useless fifth channel rather than replacing the alpha.
