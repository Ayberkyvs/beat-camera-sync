import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NoteData, COLORS } from "../types";
import { LANE_X_POSITIONS, LAYER_Y_POSITIONS, NOTE_SIZE } from "../constants";

interface NoteProps {
  data: NoteData;
  zPos: number;
  currentTime: number;
}

// Geometries - Reused for performance
const boxGeo = new THREE.BoxGeometry(NOTE_SIZE, NOTE_SIZE, NOTE_SIZE);
const ribbonV = new THREE.BoxGeometry(
  NOTE_SIZE * 0.2,
  NOTE_SIZE + 0.02,
  NOTE_SIZE + 0.02
);
const ribbonH = new THREE.BoxGeometry(
  NOTE_SIZE + 0.02,
  NOTE_SIZE * 0.2,
  NOTE_SIZE + 0.02
);

// Materials - Reused
const goldMat = new THREE.MeshStandardMaterial({
  color: "#FFD700",
  roughness: 0.3,
  metalness: 0.8,
  emissive: "#B8860B",
  emissiveIntensity: 0.2,
});

const Note: React.FC<NoteProps> = ({ data, zPos }) => {
  const boxRef = useRef<THREE.Group>(null);
  const color = data.type === "left" ? COLORS.left : COLORS.right;

  // Random rotation speed for the "Tumble" effect
  // Reduced rotation speed slightly for smoother look
  const [rotationSpeed] = useState(() => ({
    x: (Math.random() - 0.5) * 1.5,
    y: (Math.random() - 0.5) * 1.5,
    z: (Math.random() - 0.5) * 1.5,
  }));

  const position: [number, number, number] = useMemo(() => {
    return [
      LANE_X_POSITIONS[data.lineIndex],
      LAYER_Y_POSITIONS[data.lineLayer],
      zPos,
    ];
  }, [data.lineIndex, data.lineLayer, zPos]);

  useFrame((state, delta) => {
    if (boxRef.current && !data.hit && !data.missed) {
      // Rotate the box
      boxRef.current.rotation.x += rotationSpeed.x * delta;
      boxRef.current.rotation.y += rotationSpeed.y * delta;
      boxRef.current.rotation.z += rotationSpeed.z * delta;
    }
  });

  if (data.missed || data.hit) return null;

  return (
    <group position={position}>
      {/* Tumbling Gift Box Group */}
      <group ref={boxRef}>
        <mesh geometry={boxGeo}>
          <meshStandardMaterial
            color={color}
            roughness={0.2}
            metalness={0.1}
            emissive={color}
            emissiveIntensity={1.2}
          />
        </mesh>
        <mesh geometry={ribbonV} material={goldMat} />
        <mesh geometry={ribbonH} material={goldMat} />
      </group>
    </group>
  );
};

// Strict memoization to prevent re-renders when other game state changes
export default React.memo(Note, (prev, next) => {
  return (
    prev.zPos === next.zPos &&
    prev.data.hit === next.data.hit &&
    prev.data.missed === next.data.missed
  );
});
