import type { Moment, ViewMode } from "../types";

/**
 * How far to crossfade toward the alternate clip (0 = reality, 1 = alternate).
 */
export function getVideoMixTarget(
  moment: Moment,
  viewMode: ViewMode,
  selected: boolean,
): number {
  if (!moment.alternateVideoUrl) return 0;
  if (viewMode !== "what-if") return 0;

  const isBranch = moment.id.startsWith("branch-");
  if (isBranch) return 1;
  if (moment.isFork && selected) return 1;

  return 0;
}

export function getActivePanelVideo(
  moment: Moment,
  viewMode: ViewMode,
): { primary?: string; alternate?: string; mix: number } {
  const mix = getVideoMixTarget(moment, viewMode, true);
  return {
    primary: moment.videoUrl,
    alternate: moment.alternateVideoUrl ?? moment.videoUrl,
    mix,
  };
}
