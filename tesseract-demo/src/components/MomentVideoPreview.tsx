import { useEffect, useRef } from "react";
import { getActivePanelVideo } from "../utils/videoMix";
import type { Moment, ViewMode } from "../types";

interface MomentVideoPreviewProps {
  moment: Moment;
  viewMode: ViewMode;
}

export function MomentVideoPreview({ moment, viewMode }: MomentVideoPreviewProps) {
  const { primary, alternate, mix } = getActivePanelVideo(moment, viewMode);
  const primaryRef = useRef<HTMLVideoElement>(null);
  const alternateRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    void primaryRef.current?.play().catch(() => {});
    void alternateRef.current?.play().catch(() => {});
  }, [primary, alternate, viewMode]);

  if (!primary && !alternate) return null;

  return (
    <div className="video-preview">
      <div className="video-preview-inner">
        {primary && (
          <video
            ref={primaryRef}
            className="preview-clip"
            src={primary}
            muted
            loop
            playsInline
            style={{ opacity: 1 - mix }}
          />
        )}
        {alternate && alternate !== primary && (
          <video
            ref={alternateRef}
            className="preview-clip preview-clip-alt"
            src={alternate}
            muted
            loop
            playsInline
            style={{ opacity: mix }}
          />
        )}
      </div>
      {moment.isFork && moment.alternateVideoUrl && (
        <p className="video-hint">
          {viewMode === "what-if"
            ? "Crossfading to alternate timeline"
            : "Toggle What if to see the other path"}
        </p>
      )}
    </div>
  );
}
