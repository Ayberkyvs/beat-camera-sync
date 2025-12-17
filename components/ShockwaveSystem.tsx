/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS } from "../types";

const MAX_WAVES = 10; // Reduced from 50 for performance

export interface ShockwaveSystemHandle {
  spawn: (position: THREE.Vector3, colorType: "left" | "right") => void;
}

const ShockwaveSystem = forwardRef<ShockwaveSystemHandle, {}>((props, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const waves = useMemo(() => {
    return Array.from({ length: MAX_WAVES }).map(() => ({
      active: false,
      position: new THREE.Vector3(),
      scale: 0,
      opacity: 1,
      color: new THREE.Color(),
    }));
  }, []);

  const cursor = useRef(0);

  useImperativeHandle(ref, () => ({
    spawn: (position: THREE.Vector3, colorType: "left" | "right") => {
      const idx = cursor.current;
      const w = waves[idx];
      w.active = true;
      w.position.copy(position);
      w.position.z += 0.1; // Slight offset to avoid Z-fighting
      w.scale = 0.1;
      w.opacity = 1.0;
      w.color.set(colorType === "left" ? COLORS.left : COLORS.right);
      w.color.multiplyScalar(3); // Bright glow

      cursor.current = (idx + 1) % MAX_WAVES;
    },
  }));

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const safeDelta = Math.min(delta, 0.05);

    let needsUpdate = false;
    for (let i = 0; i < MAX_WAVES; i++) {
      const w = waves[i];
      if (!w.active) {
        if (w.scale !== 0) {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
          w.scale = 0;
          needsUpdate = true;
        }
        continue;
      }

      w.scale += safeDelta * 10;
      w.opacity -= safeDelta * 4.0;

      if (w.opacity <= 0) {
        w.active = false;
        dummy.scale.set(0, 0, 0);
      } else {
        dummy.position.copy(w.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(w.scale, w.scale, 1);
        meshRef.current.setColorAt(i, w.color);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor)
        meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  const geometry = useMemo(() => new THREE.RingGeometry(0.5, 0.7, 16), []);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, MAX_WAVES]}>
      <meshBasicMaterial
        toneMapped={false}
        transparent
        opacity={0.8}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
});

export default ShockwaveSystem;
