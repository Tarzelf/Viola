# Personal Tesseract — Raw Demo

A minimal explorable 3D space where life moments are **coordinates**, counterfactuals are **branch corridors**, and each portal plays a **looping video** of that moment.

Inspired by Interstellar's tesseract (time as a place you can walk) and Pantheon's simulation energy (what if this moment had gone differently?).

## Quick start

```bash
cd tesseract-demo
npm install
npm run dev
```

Open the local URL (usually `http://localhost:5173`).

## What's new: video portals

Each moment can have:

| Field | Purpose |
|-------|---------|
| `videoUrl` | What happened — plays inside the 3D portal frame |
| `alternateVideoUrl` | What-if clip — crossfades in when you toggle **What if** on a fork |
| `videoPrompt` / `alternateVideoPrompt` | Grok generation prompts (see below) |

**Try it:** Click **The words you swallowed** or **The offer**, then toggle **What if**. The portal and side panel crossfade between reality and alternate clips.

Placeholder loops live in `public/videos/`. Replace with Grok-generated clips for the real experience.

## Generate clips with Grok Imagine

```bash
export XAI_API_KEY=your_key
npm run generate:videos
# or one moment:
npm run generate:videos -- --moment job-offer
```

The script calls `grok-imagine-video-1.5`, polls until complete, and writes `public/generated-videos.json`. Paste the URLs into `src/data/moments.ts`.

**Pro tip:** Use the **same source photo** for `videoPrompt` and `alternateVideoPrompt` (image-to-video) so both branches feel like the same room, different coordinate.

Docs: https://docs.x.ai/developers/model-capabilities/video/generation

## How the space works

| Axis | Meaning |
|------|---------|
| **Z (depth)** | Time — present is near you, past recedes into the grid |
| **X (left/right)** | Branches — alternate timelines fork sideways at decision points |
| **Y (height)** | Emphasis — fork points lift slightly |

## Controls

- **Drag** — orbit the space
- **Scroll** — zoom
- **Click a frame** — read the moment, watch the portal video
- **What happened / What if** — crossfade fork portals to alternate clips

## Customize moments

Edit `src/data/moments.ts`. Each moment needs:

- `position: [x, y, z]` — where it lives in space
- `reality` — what happened (or what you remember)
- `videoUrl` — looping MP4 (local `/videos/...` or remote URL)
- `alternateVideoUrl` — optional what-if clip for forks
- `forkQuestion` + `alternates` — optional counterfactuals at decision points
- `connectsTo` — IDs of adjacent moments on the corridor
- `branchIds` — IDs of alternate-timeline nodes that fork from this moment

## Architecture

```
moments.ts (data + video URLs)
    ↓
MomentNode → VideoPortal (Three.js VideoTexture, crossfade)
    ↓
MomentPanel → MomentVideoPreview (2D sync crossfade)
```

## Next layers

1. **Interview → graph** — LLM extracts moments from a voice/text interview
2. **Grok image-to-video** — personal photos as anchor frames for both branches
3. **Personal RAG** — alternates written in your voice and values
4. **WebXR** — walk the tesseract in VR

## Philosophy

This demo does not claim to predict your life. It makes **the cone of possibility** visible — so you can sit with the feeling that the present is one collapsed coordinate among many.
