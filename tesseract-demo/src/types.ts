export interface AlternatePath {
  id: string;
  label: string;
  summary: string;
  feeling: string;
}

export interface Moment {
  id: string;
  title: string;
  when: string;
  /** What actually happened (or what you remember). */
  reality: string;
  /** The question this moment invites. */
  forkQuestion?: string;
  /** Plausible alternate paths — not prophecy, just possibility. */
  alternates?: AlternatePath[];
  position: [number, number, number];
  /** Moments you can walk to next on the main corridor. */
  connectsTo?: string[];
  /** Branch moments spawned from this fork. */
  branchIds?: string[];
  isFork?: boolean;
  isPresent?: boolean;
  /** Looping clip for what happened — Grok-generated or personal footage. */
  videoUrl?: string;
  /** Crossfades in when toggling What if on fork moments. */
  alternateVideoUrl?: string;
  /** Prompt used to generate videoUrl (for Grok pipeline). */
  videoPrompt?: string;
  /** Prompt for the alternate branch clip. */
  alternateVideoPrompt?: string;
}

export type ViewMode = "reality" | "what-if";
