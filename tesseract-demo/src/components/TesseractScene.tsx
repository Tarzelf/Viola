import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, PerspectiveCamera } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Vector3Tuple } from "three";
import { moments } from "../data/moments";
import type { ViewMode } from "../types";
import { MomentNode } from "./MomentNode";
import { Corridor } from "./Corridor";

interface TesseractSceneProps {
  selectedId: string | null;
  viewMode: ViewMode;
  onSelect: (id: string) => void;
  focusPosition: Vector3Tuple | null;
}

function CameraRig({ focusPosition }: { focusPosition: Vector3Tuple | null }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!focusPosition || !controlsRef.current) return;

    const [x, y, z] = focusPosition;
    controlsRef.current.target.set(x, y, z);
    camera.position.set(x + 2, y + 2.5, z + 6);
    controlsRef.current.update();
  }, [focusPosition, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={3}
      maxDistance={35}
      maxPolarAngle={Math.PI / 2 + 0.3}
    />
  );
}

export function TesseractScene({
  selectedId,
  viewMode,
  onSelect,
  focusPosition,
}: TesseractSceneProps) {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect("")}
    >
      <color attach="background" args={["#050508"]} />
      <fog attach="fog" args={["#050508", 12, 45]} />

      <PerspectiveCamera makeDefault position={[2, 3, 8]} fov={55} />
      <CameraRig focusPosition={focusPosition} />

      <ambientLight intensity={0.25} />
      <pointLight position={[0, 5, 0]} intensity={1.2} color="#f5d76e" />
      <pointLight position={[-8, 2, -10]} intensity={0.6} color="#7ec8e3" />
      <pointLight position={[8, 2, -10]} intensity={0.6} color="#c9a0ff" />

      <Stars radius={80} depth={40} count={3000} factor={3} fade speed={0.5} />

      <Corridor
        moments={moments}
        selectedId={selectedId}
        viewMode={viewMode}
      />

      {moments.map((moment) => (
        <MomentNode
          key={moment.id}
          moment={moment}
          selected={selectedId === moment.id}
          viewMode={viewMode}
          onSelect={onSelect}
        />
      ))}
    </Canvas>
  );
}
