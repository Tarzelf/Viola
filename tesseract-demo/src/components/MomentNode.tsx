import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { Group } from "three";
import type { Moment } from "../types";

interface MomentNodeProps {
  moment: Moment;
  selected: boolean;
  viewMode: "reality" | "what-if";
  onSelect: (id: string) => void;
}

export function MomentNode({
  moment,
  selected,
  viewMode,
  onSelect,
}: MomentNodeProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  const isBranch = moment.id.startsWith("branch-");
  const isFork = moment.isFork;
  const showBranch = viewMode === "what-if" && (isBranch || isFork);

  const baseColor = moment.isPresent
    ? "#f5d76e"
    : isBranch
      ? "#7ec8e3"
      : isFork
        ? "#c9a0ff"
        : "#e8e8e8";

  const emissive = selected ? 1.2 : hovered ? 0.8 : showBranch ? 0.5 : 0.25;
  const opacity = viewMode === "reality" && isBranch ? 0.15 : 1;

  useFrame((state) => {
    if (!groupRef.current) return;
    const pulse = moment.isPresent
      ? 1 + Math.sin(state.clock.elapsedTime * 2) * 0.04
      : 1;
    groupRef.current.scale.setScalar(selected ? 1.15 * pulse : pulse);
  });

  return (
    <group
      ref={groupRef}
      position={moment.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(moment.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* Portal frame — Interstellar bookshelf energy */}
      <mesh>
        <boxGeometry args={[2.4, 3.2, 0.12]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={emissive}
          transparent
          opacity={opacity * 0.35}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>

      {/* Inner glow plane */}
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[2.1, 2.9]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={emissive * 0.6}
          transparent
          opacity={opacity * 0.2}
          side={2}
        />
      </mesh>

      {/* Frame edges */}
      {[
        [0, 1.55, 0.07, 2.5, 0.06, 0.06],
        [0, -1.55, 0.07, 2.5, 0.06, 0.06],
        [-1.15, 0, 0.07, 0.06, 3.1, 0.06],
        [1.15, 0, 0.07, 0.06, 3.1, 0.06],
      ].map((dims, i) => (
        <mesh key={i} position={[dims[0], dims[1], dims[2]] as [number, number, number]}>
          <boxGeometry args={[dims[3], dims[4], dims[5]]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={emissive}
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}

      <Text
        position={[0, -2.1, 0.15]}
        fontSize={0.22}
        color={selected ? "#ffffff" : "#aaaaaa"}
        anchorX="center"
        anchorY="top"
        maxWidth={2.2}
        textAlign="center"
      >
        {moment.title}
      </Text>
    </group>
  );
}
