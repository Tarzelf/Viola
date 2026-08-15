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
not work for this, because it removes the *background* and keeps the whole
*person*. Cropping to a garment box and running it returns the garment plus
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

## The catch: granularity

The taxonomy is **category-level, not item-level**. The test photo has a red
graphic tee *and* a black jacket, and the model labels both as one
`Upper-clothes` region. It cannot tell you there are two garments there, and it
cannot separate them.

So a sticker is "the upper layer", not "the tee" and "the jacket".

## What this does and does not replace

Segmentation gives you a **picture of the actual garment**. It cannot give you
`HOKA Skyward X`, a price, or a link — no local model can read a brand off a
photo. That still needs the vision model.

The two approaches are complementary rather than competing:

| | Cut-out sticker | Catalogue image |
|---|---|---|
| Needs an API key | no | yes |
| Cost per look | zero | ~$0.027 |
| Shows the actual item worn | yes | no |
| Sharp enough to shop from | no | yes |
| Granularity | category | per item |

## Two gotchas that cost real time

**`dest-in` does not mask with a greyscale image.** It reads the *source's
alpha*, and a greyscale PNG is opaque everywhere, so compositing a mask that
way silently does nothing — you get the full rectangle back. The mask has to
*become* the alpha channel. This bit twice: once masking the photo, once
building the sticker keyline, which rendered as a white box instead of hugging
the silhouette.

**`joinChannel` needs `removeAlpha()` first.** Joining a mask onto an already
RGBA image appends a useless fifth channel rather than replacing the alpha.
