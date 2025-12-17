/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS } from "../types";

// Optimization: Reduced particle counts for stable 60FPS
const MAX_PARTICLES = 200;
const SHARDS_PER_EXPLOSION = 12;

export interface DebrisSystemHandle {
  explode: (position: THREE.Vector3, colorType: "left" | "right") => void;
}

const DebrisSystem = forwardRef<DebrisSystemHandle, {}>((props, ref) => {
  const leftMeshRef = useRef<THREE.InstancedMesh>(null);
  const rightMeshRef = useRef<THREE.InstancedMesh>(null);

  // Object Pooling State
  const particles = useMemo(() => {
    const createPool = () =>
      Array.from({ length: MAX_PARTICLES }).map(() => ({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        scale: 1,
        active: false,
      }));
    return {
      left: createPool(),
      right: createPool(),
    };
  }, []);

  const cursor = useRef({ left: 0, right: 0 });

  useImperativeHandle(ref, () => ({
    explode: (position: THREE.Vector3, colorType: "left" | "right") => {
      const list = particles[colorType];
      let idx = cursor.current[colorType];

      for (let i = 0; i < SHARDS_PER_EXPLOSION; i++) {
        const p = list[idx];
        p.active = true;
        p.life = 0.8 + Math.random() * 0.4; // Shorter life
        p.position.copy(position);

        // Explosive velocity cone
        p.velocity.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 5 - 1
        );

        p.scale = Math.random() * 0.4 + 0.3;
        idx = (idx + 1) % MAX_PARTICLES;
      }
      cursor.current[colorType] = idx;
    },
  }));

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.06);

    const updateMesh = (mesh: THREE.InstancedMesh, list: any[]) => {
      let needsUpdate = false;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = list[i];

        if (!p.active) {
          if (p.scale !== 0) {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            p.scale = 0;
            needsUpdate = true;
          }
          continue;
        }

        p.life -= safeDelta * 3.0;

        if (p.life <= 0) {
          p.active = false;
          dummy.scale.set(0, 0, 0);
        } else {
          p.velocity.y -= 9.8 * safeDelta * 0.5;
          p.position.addScaledVector(p.velocity, safeDelta);

          dummy.position.copy(p.position);
          const lookTarget = p.position.clone().add(p.velocity);
          dummy.lookAt(lookTarget);

          // Thinner debris for cleaner look
          dummy.scale.set(0.015, 0.015, p.scale * 1.5);
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      }

      if (needsUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    };

    if (leftMeshRef.current) updateMesh(leftMeshRef.current, particles.left);
    if (rightMeshRef.current) updateMesh(rightMeshRef.current, particles.right);
  });

  // Low poly geometry
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <>
      <instancedMesh
        ref={leftMeshRef}
        args={[geometry, undefined, MAX_PARTICLES]}
      >
        <meshBasicMaterial
          color={COLORS.left}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </instancedMesh>
      <instancedMesh
        ref={rightMeshRef}
        args={[geometry, undefined, MAX_PARTICLES]}
      >
        <meshBasicMaterial
          color={COLORS.right}
          toneMapped={false}
          transparent
          opacity={0.7}
        />
      </instancedMesh>
    </>
  );
});

export default DebrisSystem;
