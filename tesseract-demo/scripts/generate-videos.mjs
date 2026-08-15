#!/usr/bin/env node
/**
 * Grok Imagine video generation stub.
 *
 * Generates reality + alternate clips for fork moments in moments.ts,
 * then writes a JSON manifest you can paste back into the data file.
 *
 * Usage:
 *   XAI_API_KEY=your_key node scripts/generate-videos.mjs
 *   XAI_API_KEY=your_key node scripts/generate-videos.mjs --moment job-offer
 *
 * Requires: Node 18+ (native fetch)
 * Docs: https://docs.x.ai/developers/model-capabilities/video/generation
 */

const API_BASE = "https://api.x.ai/v1";
const MODEL = "grok-imagine-video-1.5";

/** @type {Array<{ id: string; videoPrompt?: string; alternateVideoPrompt?: string; imageUrl?: string }>} */
const GENERATION_QUEUE = [
  {
    id: "present",
    videoPrompt:
      "Slow cinematic drift through soft morning light, abstract and calm, present moment stillness, shallow depth of field, 24fps film grain",
  },
  {
    id: "almost-said-it",
    imageUrl: undefined, // paste your photo URL here for image-to-video
    videoPrompt:
      "Rain on window at night, two silhouettes at a table in soft focus, heavy silence, slow push-in, melancholic ambient mood",
    alternateVideoPrompt:
      "Same room, same rain — one person leans forward speaking, the other's shoulders drop with relief, warm lamp light, emotional release",
  },
  {
    id: "job-offer",
    imageUrl: undefined,
    videoPrompt:
      "Quiet suburban morning, kitchen table, coffee steam, someone sits down slowly, stayed-home energy, gentle handheld drift",
    alternateVideoPrompt:
      "Same kitchen angle but suitcase by the door, city skyline glimpse through window, departure light, bittersweet leaving",
  },
  {
    id: "moved-here",
    videoPrompt:
      "Childhood hallway, warm afternoon dust in sunbeams, door at the end slightly open, someone calling from another room, nostalgic slow pan",
  },
];

const momentFilter = process.argv.includes("--moment")
  ? process.argv[process.argv.indexOf("--moment") + 1]
  : null;

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error("Missing XAI_API_KEY environment variable.");
  console.error("Get a key at https://console.x.ai/");
  process.exit(1);
}

async function startGeneration({ prompt, imageUrl }) {
  const body = {
    model: MODEL,
    prompt,
    duration: 8,
    aspect_ratio: "3:4",
    resolution: "720p",
  };

  if (imageUrl) {
    body.image = { url: imageUrl };
  }

  const res = await fetch(`${API_BASE}/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Generation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.request_id;
}

async function pollUntilDone(requestId, { intervalMs = 5000, timeoutMs = 300000 } = {}) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${API_BASE}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Poll failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const status = data.status ?? data.state;

    if (status === "completed" || status === "done") {
      const url =
        data.video?.url ??
        data.output?.url ??
        data.result?.url ??
        data.url;
      if (!url) throw new Error(`Completed but no URL in response: ${JSON.stringify(data)}`);
      return url;
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Generation failed: ${JSON.stringify(data)}`);
    }

    console.log(`  … ${requestId} (${status ?? "pending"})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Timed out waiting for ${requestId}`);
}

async function generateClip(label, prompt, imageUrl) {
  console.log(`\n▶ ${label}`);
  console.log(`  prompt: ${prompt.slice(0, 80)}…`);
  const requestId = await startGeneration({ prompt, imageUrl });
  const url = await pollUntilDone(requestId);
  console.log(`  ✓ ${url}`);
  return url;
}

async function main() {
  const queue = momentFilter
    ? GENERATION_QUEUE.filter((m) => m.id === momentFilter)
    : GENERATION_QUEUE;

  if (queue.length === 0) {
    console.error(`No moment found for id: ${momentFilter}`);
    process.exit(1);
  }

  /** @type {Record<string, { videoUrl?: string; alternateVideoUrl?: string }>} */
  const manifest = {};

  for (const moment of queue) {
    console.log(`\n━━ ${moment.id} ━━`);
    manifest[moment.id] = {};

    if (moment.videoPrompt) {
      manifest[moment.id].videoUrl = await generateClip(
        "reality",
        moment.videoPrompt,
        moment.imageUrl,
      );
    }

    if (moment.alternateVideoPrompt) {
      manifest[moment.id].alternateVideoUrl = await generateClip(
        "alternate",
        moment.alternateVideoPrompt,
        moment.imageUrl, // same anchor photo = Pantheon/Interstellar trick
      );
    }
  }

  const outPath = new URL("../public/generated-videos.json", import.meta.url);
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(outPath, JSON.stringify(manifest, null, 2)),
  );

  console.log("\n✅ Wrote public/generated-videos.json");
  console.log("Paste videoUrl / alternateVideoUrl into src/data/moments.ts\n");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
