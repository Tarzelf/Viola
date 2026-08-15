'use client';

import { Canvas } from '@react-three/fiber';
import { color } from '@viola/design';
import type { FoldAngles, FoldLattice, FoldMode, FoldPath } from '@viola/core';
import { FoldScene } from './fold-scene';

interface FoldCanvasProps {
  lattice: FoldLattice;
  angles: FoldAngles;
  mode: FoldMode;
  selectedId: string | null;
  returns: FoldPath[];
  onSelect: (id: string | null) => void;
}

export function FoldCanvas({
  lattice,
  angles,
  mode,
  selectedId,
  returns,
  onSelect,
}: FoldCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.28, 6.4], fov: 40, near: 0.1, far: 60 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[color.ink]} />
      <fog attach="fog" args={[color.ink, 7.5, 18]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[2.4, 2.2, 3.2]} intensity={18} color={color.viola} distance={16} />
      <pointLight position={[-3, -1.2, 2]} intensity={8} color={color.orchid} distance={14} />
      <FoldScene
        lattice={lattice}
        angles={angles}
        mode={mode}
        selectedId={selectedId}
        returns={returns}
        onSelect={onSelect}
      />
    </Canvas>
  );
}
