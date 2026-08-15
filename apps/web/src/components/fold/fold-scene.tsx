'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { color } from '@viola/design';
import {
  projectPoint,
  type FoldAngles,
  type FoldLattice,
  type FoldMode,
  type FoldPath,
} from '@viola/core';
import { mediaUrl } from '@/lib/media';

interface FoldSceneProps {
  lattice: FoldLattice;
  angles: FoldAngles;
  mode: FoldMode;
  selectedId: string | null;
  returns: FoldPath[];
  onSelect: (id: string | null) => void;
}

export function FoldScene({
  lattice,
  angles,
  mode,
  selectedId,
  returns,
  onSelect,
}: FoldSceneProps) {
  const activePaths = mode === 'return' ? returns : lattice.paths;
  const emphasize = new Set(activePaths.flatMap((path) => path.nodes));
  return (
    <group>
      <EnergyDust />
      <TesseractWire lattice={lattice} angles={angles} />
      {activePaths.map((path) => (
        <EnergyFilament
          key={path.id}
          lattice={lattice}
          path={path}
          angles={angles}
          strong={mode !== 'moments'}
        />
      ))}
      {lattice.moments.map((moment) => {
        const position = projectPoint(moment.p4, angles);
        const dimmed = Boolean(
          selectedId &&
          (mode === 'return' || mode === 'scenarios') &&
          !emphasize.has(moment.id) &&
          moment.id !== selectedId,
        );
        return (
          <MomentCell
            key={moment.id}
            photoPath={moment.photoPath}
            energy={moment.energy}
            position={position}
            selected={moment.id === selectedId}
            dimmed={dimmed}
            onSelect={() => onSelect(moment.id === selectedId ? null : moment.id)}
          />
        );
      })}
    </group>
  );
}

function TesseractWire({ lattice, angles }: { lattice: FoldLattice; angles: FoldAngles }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(lattice.tesseract.edges.length * 6), 3),
    );
    return geo;
  }, [lattice.tesseract.edges.length]);

  useFrame(() => {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    let i = 0;
    for (const [a, b] of lattice.tesseract.edges) {
      const pa = projectPoint(lattice.tesseract.vertices[a]!, angles);
      const pb = projectPoint(lattice.tesseract.vertices[b]!, angles);
      attr.setXYZ(i++, pa[0], pa[1], pa[2]);
      attr.setXYZ(i++, pb[0], pb[1], pb[2]);
    }
    attr.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color.viola} transparent opacity={0.22} />
    </lineSegments>
  );
}

function EnergyFilament({
  lattice,
  path,
  angles,
  strong,
}: {
  lattice: FoldLattice;
  path: FoldPath;
  angles: FoldAngles;
  strong: boolean;
}) {
  const byId = useMemo(() => new Map(lattice.moments.map((m) => [m.id, m])), [lattice.moments]);
  const segments = Math.max(path.nodes.length - 1, 0);
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 6), 3));
    return geo;
  }, [segments]);

  const pulse = useRef<THREE.Points>(null);
  const pulseGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const pts: THREE.Vector3[] = [];
    for (const id of path.nodes) {
      const moment = byId.get(id);
      if (!moment) continue;
      const [x, y, z] = projectPoint(moment.p4, angles);
      pts.push(new THREE.Vector3(x, y, z));
    }

    const attr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < segments; i++) {
      const a = pts[i] ?? pts[0] ?? new THREE.Vector3();
      const b = pts[i + 1] ?? a;
      attr.setXYZ(i * 2, a.x, a.y, a.z);
      attr.setXYZ(i * 2 + 1, b.x, b.y, b.z);
    }
    attr.needsUpdate = true;

    if (pts.length >= 2 && pulse.current) {
      const t = (clock.elapsedTime * (0.12 + path.energy * 0.25)) % 1;
      const curve = new THREE.CatmullRomCurve3(pts);
      const p = curve.getPoint(t);
      const pulseAttr = pulseGeo.getAttribute('position') as THREE.BufferAttribute;
      pulseAttr.setXYZ(0, p.x, p.y, p.z);
      pulseAttr.needsUpdate = true;
    }
  });

  const pathColor =
    path.kind === 'return' ? color.orchid : path.kind === 'kinship' ? color.blush : color.viola;

  return (
    <group>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color={pathColor} transparent opacity={strong ? 0.55 : 0.16} />
      </lineSegments>
      <points ref={pulse} geometry={pulseGeo}>
        <pointsMaterial
          color={pathColor}
          size={strong ? 0.09 : 0.05}
          transparent
          opacity={strong ? 0.95 : 0.4}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function MomentCell({
  photoPath,
  energy,
  position,
  selected,
  dimmed,
  onSelect,
}: {
  photoPath: string;
  energy: number;
  position: readonly [number, number, number];
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const texture = useLookTexture(mediaUrl(photoPath));
  const width = selected ? 0.5 : 0.38;
  const height = width * 1.25;
  const opacity = dimmed ? 0.22 : selected ? 1 : 0.92;
  const frame = useMemo(() => {
    const plane = new THREE.PlaneGeometry(width, height);
    const edges = new THREE.EdgesGeometry(plane);
    plane.dispose();
    return edges;
  }, [width, height]);

  useEffect(() => () => frame.dispose(), [frame]);

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <planeGeometry args={[width, height]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} transparent opacity={opacity} />
        ) : (
          <meshBasicMaterial color={color.surfaceRaised} transparent opacity={opacity} />
        )}
      </mesh>
      <lineSegments geometry={frame}>
        <lineBasicMaterial
          color={selected ? color.viola : color.paper}
          transparent
          opacity={selected ? 0.9 : 0.18 + energy * 0.25}
        />
      </lineSegments>
    </group>
  );
}

function EnergyDust() {
  const points = useRef<THREE.Points>(null);
  const { positions, seeds } = useMemo(() => {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 1.4 + Math.random() * 3.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
      positions[i * 3 + 2] = r * Math.cos(phi);
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, seeds };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame(({ clock }) => {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < seeds.length; i++) {
      const y = positions[i * 3 + 1]! + Math.sin(t * 0.18 + seeds[i]!) * 0.04;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color={color.viola}
        size={0.025}
        transparent
        opacity={0.35}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function useLookTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.minFilter = THREE.LinearFilter;
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  return texture;
}
