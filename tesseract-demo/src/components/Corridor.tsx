import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { Moment } from "../types";

interface CorridorProps {
  moments: Moment[];
  selectedId: string | null;
  viewMode: "reality" | "what-if";
}

export function Corridor({ moments, selectedId, viewMode }: CorridorProps) {
  const lines = useMemo(() => {
    const edges: {
      from: [number, number, number];
      to: [number, number, number];
      isBranch: boolean;
      isActive: boolean;
    }[] = [];

    for (const moment of moments) {
      if (!moment.connectsTo) continue;

      for (const targetId of moment.connectsTo) {
        const target = moments.find((m) => m.id === targetId);
        if (!target) continue;

        const isBranch =
          moment.id.startsWith("branch-") ||
          target.id.startsWith("branch-") ||
          moment.branchIds?.includes(target.id);

        if (viewMode === "reality" && isBranch) continue;

        const isActive =
          selectedId === moment.id || selectedId === target.id;

        edges.push({
          from: moment.position,
          to: target.position,
          isBranch: Boolean(isBranch),
          isActive,
        });
      }

      if (viewMode === "what-if" && moment.branchIds) {
        for (const branchId of moment.branchIds) {
          const branch = moments.find((m) => m.id === branchId);
          if (!branch) continue;

          edges.push({
            from: moment.position,
            to: branch.position,
            isBranch: true,
            isActive:
              selectedId === moment.id || selectedId === branch.id,
          });
        }
      }
    }

    return edges;
  }, [moments, selectedId, viewMode]);

  return (
    <group>
      {lines.map((edge, i) => (
        <Line
          key={i}
          points={[edge.from, edge.to]}
          color={edge.isActive ? "#ffffff" : edge.isBranch ? "#7ec8e3" : "#555555"}
          lineWidth={edge.isActive ? 2 : 1}
          transparent
          opacity={edge.isActive ? 0.9 : edge.isBranch ? 0.5 : 0.35}
          dashed={edge.isBranch}
          dashSize={0.4}
          gapSize={0.25}
        />
      ))}

      {/* Floor grid — spatial reference */}
      <gridHelper
        args={[60, 60, "#1a1a2e", "#12121f"]}
        position={[0, -2, -9]}
      />
    </group>
  );
}
