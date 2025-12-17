/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import * as THREE from "three";
import { HandType, COLORS } from "../types";

interface SaberProps {
  type: HandType;
  positionRef: React.MutableRefObject<THREE.Vector3 | null>;
  velocityRef: React.MutableRefObject<THREE.Vector3 | null>;
}

// Custom Shader for Candy Cane Spiral Pattern
const CandySaberMaterial = {
  uniforms: {
    color1: { value: new THREE.Color() },
    color2: { value: new THREE.Color() },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform float time;
    
    void main() {
      float spiral = vUv.y * 10.0 + vUv.x * 2.0;
      float offset = time * -2.0; 
      float pattern = step(0.5, fract(spiral + offset));
      vec3 finalColor = mix(color1, color2, pattern);
      float shine = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 3.0);
      finalColor += vec3(shine) * 0.4;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

const Saber: React.FC<SaberProps> = ({ type, positionRef, velocityRef }) => {
  const meshRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const saberLength = 1.1;

  const targetRotation = useRef(new THREE.Euler());

  const mainColor = useMemo(
    () => new THREE.Color(type === "left" ? COLORS.left : COLORS.right),
    [type]
  );
  const whiteColor = useMemo(() => new THREE.Color("#ffffff"), []);

  const shaderArgs = useMemo(
    () => ({
      uniforms: {
        color1: { value: whiteColor },
        color2: { value: mainColor },
        time: { value: 0 },
      },
      vertexShader: CandySaberMaterial.vertexShader,
      fragmentShader: CandySaberMaterial.fragmentShader,
    }),
    [mainColor, whiteColor]
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const targetPos = positionRef.current;
    const velocity = velocityRef.current;

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }

    if (targetPos) {
      meshRef.current.visible = true;
      meshRef.current.position.lerp(targetPos, 0.85);

      const restingX = -Math.PI / 3.5;
      const restingY = 0;
      const restingZ = type === "left" ? 0.2 : -0.2;

      let swayX = 0;
      let swayY = 0;
      let swayZ = 0;

      if (velocity) {
        swayX = velocity.y * 0.05;
        swayZ = -velocity.x * 0.05;
        swayX += velocity.z * 0.02;
      }

      targetRotation.current.set(
        restingX + swayX,
        restingY + swayY,
        restingZ + swayZ
      );

      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        targetRotation.current.x,
        0.3
      );
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        targetRotation.current.y,
        0.3
      );
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
        meshRef.current.rotation.z,
        targetRotation.current.z,
        0.3
      );
    } else {
      meshRef.current.visible = false;
    }
  });

  return (
    <group ref={meshRef}>
      {/* Handle */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.16, 8]} />
        <meshStandardMaterial color="#222" roughness={0.4} metalness={0.8} />
      </mesh>

      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.05, 12]} />
        <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={1} />
      </mesh>

      {/* Candy Blade */}
      <group>
        <mesh position={[0, 0.05 + saberLength / 2, 0]}>
          <cylinderGeometry args={[0.018, 0.018, saberLength, 16]} />
          <shaderMaterial
            ref={materialRef}
            args={[shaderArgs]}
            toneMapped={false}
          />
        </mesh>

        {/* Glow Halo - Reduced opacity for performance/clarity */}
        <mesh position={[0, 0.05 + saberLength / 2, 0]}>
          <capsuleGeometry args={[0.03, saberLength, 4, 8]} />
          <meshBasicMaterial
            color={mainColor}
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Optimized Trail: Shorter, less segments */}
      <Trail
        width={0.4}
        length={3}
        color={type === "left" ? "#ff8888" : "#8888ff"}
        attenuation={(t) => t * t}
        interval={2}
        target={undefined}
      >
        <group position={[0, 0.5, 0]} />
      </Trail>

      {/* Pointlight distance reduced */}
      <pointLight
        color={mainColor}
        intensity={1}
        distance={3}
        decay={2}
        position={[0, 0.5, 0]}
      />
    </group>
  );
};

export default Saber;
