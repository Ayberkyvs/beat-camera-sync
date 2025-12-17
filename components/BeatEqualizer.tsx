import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BEAT_TIME } from "../constants";

const BAR_COUNT_PER_SIDE = 10;
const SPACING = 3;
const START_Z = -5;

interface BeatEqualizerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
}

const BeatEqualizer: React.FC<BeatEqualizerProps> = ({ audioRef }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Reuse dummy object and color
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const positions = useMemo(() => {
    const pos: { x: number; z: number; offset: number }[] = [];
    for (let i = 0; i < BAR_COUNT_PER_SIDE; i++) {
      pos.push({ x: -4, z: START_Z - i * SPACING, offset: i * 0.5 });
    }
    for (let i = 0; i < BAR_COUNT_PER_SIDE; i++) {
      pos.push({ x: 4, z: START_Z - i * SPACING, offset: i * 0.5 });
    }
    return pos;
  }, []);

  useFrame(() => {
    if (!meshRef.current || !audioRef.current) return;

    const time = audioRef.current.currentTime;
    const beatPhase = (time % BEAT_TIME) / BEAT_TIME;
    const pulse = Math.pow(1 - beatPhase, 3);

    const instanceMatrix = meshRef.current.instanceMatrix;
    const instanceColor = meshRef.current.instanceColor;

    positions.forEach((p, i) => {
      const wave = Math.sin(time * 4 - p.offset);
      const height = 0.5 + pulse * 2 * Math.max(0, wave) + 0.2;

      dummy.position.set(p.x, height / 2, p.z);
      dummy.scale.set(0.5, height, 0.5);
      dummy.updateMatrix();

      // eski: instanceMatrix.set(i, dummy.matrix);
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      if (meshRef.current!.instanceColor) {
        color.setHSL(0.6 + height * 0.1, 0.8, 0.5);
        // eski: instanceColor.setXYZ(i, color.r, color.g, color.b);
        meshRef.current!.setColorAt(i, color);
      }
    });

    // Matris ve renk güncellemesi
    meshRef.current!.instanceMatrix.needsUpdate = true;
    if (meshRef.current!.instanceColor)
      meshRef.current!.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, positions.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#444"
        emissive="#222"
        emissiveIntensity={0.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

export default BeatEqualizer;
