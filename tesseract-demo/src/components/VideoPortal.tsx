import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useLoopingVideoTexture } from "../hooks/useLoopingVideoTexture";

interface VideoPortalProps {
  realityUrl?: string;
  alternateUrl?: string;
  /** 0 = reality, 1 = alternate */
  mixTarget: number;
  opacity?: number;
  emissive: number;
  baseColor: string;
}

export function VideoPortal({
  realityUrl,
  alternateUrl,
  mixTarget,
  opacity = 1,
  emissive,
  baseColor,
}: VideoPortalProps) {
  const mix = useRef(0);
  const realityMat = useRef<THREE.MeshBasicMaterial>(null);
  const alternateMat = useRef<THREE.MeshBasicMaterial>(null);
  const realityTexture = useLoopingVideoTexture(realityUrl);
  const alternateTexture = useLoopingVideoTexture(alternateUrl);

  useFrame((_, delta) => {
    mix.current = THREE.MathUtils.damp(mix.current, mixTarget, 5, delta);

    if (realityMat.current) {
      realityMat.current.opacity = opacity * (1 - mix.current);
    }
    if (alternateMat.current) {
      alternateMat.current.opacity = opacity * mix.current;
    }
    if (realityTexture) realityTexture.needsUpdate = true;
    if (alternateTexture) alternateTexture.needsUpdate = true;
  });

  const hasVideo = Boolean(realityTexture || alternateTexture);

  if (!hasVideo) {
    return (
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[2.1, 2.9]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={emissive * 0.6}
          transparent
          opacity={opacity * 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  return (
    <group position={[0, 0, 0.08]}>
      {realityTexture && (
        <mesh>
          <planeGeometry args={[2.1, 2.9]} />
          <meshBasicMaterial
            ref={realityMat}
            map={realityTexture}
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}
      {alternateTexture && (
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[2.1, 2.9]} />
          <meshBasicMaterial
            ref={alternateMat}
            map={alternateTexture}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[2.1, 2.9]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={emissive * 0.15}
          transparent
          opacity={opacity * 0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
