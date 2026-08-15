import { useEffect, useState } from "react";
import * as THREE from "three";

export function useLoopingVideoTexture(url: string | undefined) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    void video.play().catch(() => {
      // Autoplay may be blocked until the first user gesture.
    });
    setTexture(tex);

    return () => {
      tex.dispose();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  return texture;
}
