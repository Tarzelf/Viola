import type { Moment } from "../types";

/**
 * Raw demo data — replace with interview output or personal ingest later.
 *
 * Spatial layout:
 * - Z axis = time (0 = present, negative = past)
 * - X axis = timeline branches (0 = main path, ± = alternates)
 * - Y axis = slight lift for emphasis on fork points
 *
 * Videos: placeholder ambient loops in /public/videos/.
 * Replace with Grok-generated clips via `npm run generate:videos`.
 */
export const moments: Moment[] = [
  {
    id: "present",
    title: "This moment",
    when: "Now",
    reality:
      "You are here. The present is the only coordinate where choice still lives. Everything behind you is memory; everything ahead is fog.",
    position: [0, 0, 0],
    isPresent: true,
    connectsTo: ["almost-said-it"],
    videoUrl: "/videos/present.mp4",
    videoPrompt:
      "Slow cinematic drift through soft morning light, abstract present-moment stillness, shallow depth of field",
  },
  {
    id: "almost-said-it",
    title: "The words you swallowed",
    when: "Last winter",
    reality:
      "You had the sentence formed. You could feel the shape of it in your mouth. You chose silence instead — not from cowardice, but from timing you still can't name.",
    forkQuestion: "What if you had said it?",
    alternates: [
      {
        id: "said-it",
        label: "You spoke",
        summary:
          "The relationship doesn't magically fix. But something unblocks. A tension that had been calcifying gets air. You don't know if it lasts — but that week, you sleep differently.",
        feeling: "Relief mixed with exposure — like stepping into cold water on purpose.",
      },
      {
        id: "wrote-it",
        label: "You wrote it instead",
        summary:
          "A letter, sent at 2am. They read it twice. The conversation happens slower, on paper first — which gives you both room to not perform.",
        feeling: "Courage at a safer distance.",
      },
    ],
    position: [0, 0, -5],
    isFork: true,
    connectsTo: ["present", "job-offer"],
    branchIds: ["branch-said-it", "branch-wrote-it"],
    videoUrl: "/videos/silence.mp4",
    alternateVideoUrl: "/videos/fork-warm.mp4",
    videoPrompt:
      "Rain on window at night, two silhouettes at a table, heavy silence, slow push-in, melancholic",
    alternateVideoPrompt:
      "Same room — one person leans forward speaking, the other's shoulders drop with relief, warm lamp light",
  },
  {
    id: "branch-said-it",
    title: "Branch · You spoke",
    when: "Last winter (alternate)",
    reality:
      "The relationship doesn't magically fix. But something unblocks. A tension that had been calcifying gets air. You don't know if it lasts — but that week, you sleep differently.",
    position: [4, 0.5, -5],
    connectsTo: ["job-offer-alt"],
    videoUrl: "/videos/fork-warm.mp4",
  },
  {
    id: "branch-wrote-it",
    title: "Branch · You wrote it",
    when: "Last winter (alternate)",
    reality:
      "A letter, sent at 2am. They read it twice. The conversation happens slower, on paper first — which gives you both room to not perform.",
    position: [-4, 0.5, -5],
    connectsTo: ["job-offer"],
    videoUrl: "/videos/fork-cool.mp4",
  },
  {
    id: "job-offer",
    title: "The offer",
    when: "Three years ago",
    reality:
      "A role in another city. More money. A version of you that doesn't exist yet, waving from across the distance. You said no — family, roots, fear dressed as loyalty.",
    forkQuestion: "What if you had said yes?",
    alternates: [
      {
        id: "took-job",
        label: "You left",
        summary:
          "First six months: loneliness, then competence. You build a self that doesn't need the old room to know who it is. Holidays are expensive. You are harder and more free.",
        feeling: "Pride with a hairline crack of grief.",
      },
      {
        id: "stayed",
        label: "You stayed (what happened)",
        summary:
          "The life you know. Not lesser — just the path where comfort won the argument that year.",
        feeling: "Familiarity. Sometimes mistaken for peace.",
      },
    ],
    position: [0, 0, -11],
    isFork: true,
    connectsTo: ["almost-said-it", "moved-here"],
    branchIds: ["branch-took-job", "branch-stayed"],
    videoUrl: "/videos/stayed.mp4",
    alternateVideoUrl: "/videos/left.mp4",
    videoPrompt:
      "Quiet suburban morning, kitchen table, coffee steam, someone sits down slowly, stayed-home energy",
    alternateVideoPrompt:
      "Same kitchen but suitcase by the door, city skyline through window, bittersweet departure light",
  },
  {
    id: "branch-took-job",
    title: "Branch · You left",
    when: "Three years ago (alternate)",
    reality:
      "First six months: loneliness, then competence. You build a self that doesn't need the old room to know who it is. Holidays are expensive. You are harder and more free.",
    position: [5, 0.5, -11],
    connectsTo: ["moved-here-alt"],
    videoUrl: "/videos/left.mp4",
  },
  {
    id: "branch-stayed",
    title: "Branch · You stayed",
    when: "Three years ago (alternate)",
    reality:
      "The life you know. Not lesser — just the path where comfort won the argument that year.",
    position: [-5, 0.5, -11],
    connectsTo: ["moved-here"],
    videoUrl: "/videos/stayed.mp4",
  },
  {
    id: "moved-here",
    title: "When you arrived here",
    when: "Childhood",
    reality:
      "A doorway. A smell you can't recreate. Someone calling your name from another room. This is the bedrock — the first coordinate everything else measures from.",
    position: [0, 0, -18],
    connectsTo: ["job-offer"],
    videoUrl: "/videos/doorway.mp4",
    videoPrompt:
      "Childhood hallway, warm afternoon dust in sunbeams, door at the end slightly open, nostalgic slow pan",
  },
  {
    id: "job-offer-alt",
    title: "The offer (from spoken branch)",
    when: "Three years ago",
    reality:
      "You arrive at this decision already lighter. The job offer feels less like escape, more like option. The choice is cleaner.",
    position: [4, 0, -11],
    connectsTo: ["branch-said-it"],
  },
  {
    id: "moved-here-alt",
    title: "When you arrived (alternate life)",
    when: "Childhood",
    reality:
      "Same doorway. Same smell. But from the branch where you left, this memory hits different — it's the place you measure distance from, not the place you measure life by.",
    position: [5, 0, -18],
    connectsTo: ["branch-took-job"],
  },
];

export const momentMap = new Map(moments.map((m) => [m.id, m]));

export function getConnectedMoments(id: string): Moment[] {
  const moment = momentMap.get(id);
  if (!moment?.connectsTo) return [];
  return moment.connectsTo
    .map((cid) => momentMap.get(cid))
    .filter((m): m is Moment => Boolean(m));
}
