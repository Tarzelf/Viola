# Personal Tesseract — Raw Demo

A minimal explorable 3D space where life moments are **coordinates**, and counterfactuals are **branch corridors**.

Inspired by Interstellar's tesseract (time as a place you can walk) and Pantheon's simulation energy (what if this moment had gone differently?).

## Quick start

```bash
cd tesseract-demo
npm install
npm run dev
```

Open the local URL (usually `http://localhost:5173`).

## How the space works

| Axis | Meaning |
|------|---------|
| **Z (depth)** | Time — present is near you, past recedes into the grid |
| **X (left/right)** | Branches — alternate timelines fork sideways at decision points |
| **Y (height)** | Emphasis — fork points lift slightly |

Each glowing frame is a **moment**. Lines connect moments you can walk between. Dashed blue lines are **what-if branches** (visible when you toggle "What if").

## Controls

- **Drag** — orbit the space
- **Scroll** — zoom
- **Click a frame** — read the moment, see alternates
- **What happened / What if** — hide or reveal branch corridors

## Customize moments

Edit `src/data/moments.ts`. Each moment needs:

- `position: [x, y, z]` — where it lives in space
- `reality` — what happened (or what you remember)
- `forkQuestion` + `alternates` — optional counterfactuals at decision points
- `connectsTo` — IDs of adjacent moments on the corridor
- `branchIds` — IDs of alternate-timeline nodes that fork from this moment

## Next layers (when you're ready)

1. **Interview → graph** — LLM extracts moments from a 10-minute voice/text interview, outputs JSON in this shape
2. **Image fill** — generate a scene per moment (Flux/Midjourney) as the portal texture
3. **Personal RAG** — ingest journals/texts so alternates use your voice and values
4. **VR** — same scene in WebXR

## Philosophy

This demo does not claim to predict your life. It makes **the cone of possibility** visible — so you can sit with the feeling that the present is one collapsed coordinate among many.
