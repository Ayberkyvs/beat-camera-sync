/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Create static positions
  const positions = useMemo(() => {
    const pos: { x: number; z: number; offset: number }[] = [];
    // Left side
    for (let i = 0; i < BAR_COUNT_PER_SIDE; i++) {
      pos.push({ x: -4, z: START_Z - i * SPACING, offset: i * 0.5 });
    }
    // Right side
    for (let i = 0; i < BAR_COUNT_PER_SIDE; i++) {
      pos.push({ x: 4, z: START_Z - i * SPACING, offset: i * 0.5 });
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !audioRef.current) return;

    const time = audioRef.current.currentTime;
    const beatPhase = (time % BEAT_TIME) / BEAT_TIME;
    // Basic pulse
    const pulse = Math.pow(1 - beatPhase, 3);

    positions.forEach((p, i) => {
      // Calculate height based on pulse + wave offset
      // We create a wave that travels down the track
      const wave = Math.sin(time * 4 - p.offset);
      const height = 0.5 + pulse * 2 * Math.max(0, wave) + 0.2;

      dummy.position.set(p.x, height / 2, p.z);
      dummy.scale.set(0.5, height, 0.5);
      dummy.rotation.set(0, 0, 0);

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Color gradient based on height
      const color = new THREE.Color();
      color.setHSL(0.6 + height * 0.1, 0.8, 0.5); // Blue-ish
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, positions.length]}
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
