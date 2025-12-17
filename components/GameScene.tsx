/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, PerspectiveCamera, Stars } from "@react-three/drei";
import * as THREE from "three";
import {
  GameStatus,
  NoteData,
  HandPositions,
  COLORS,
  CutDirection,
} from "../types";
import {
  PLAYER_Z,
  SPAWN_Z,
  MISS_Z,
  NOTE_SPEED,
  LANE_X_POSITIONS,
  LAYER_Y_POSITIONS,
  BEAT_TIME,
} from "../constants";
import Note from "./Note";
import Saber from "./Saber";
import DebrisSystem, { DebrisSystemHandle } from "./DebrisSystem";
import ShockwaveSystem, { ShockwaveSystemHandle } from "./ShockwaveSystem";

interface GameSceneProps {
  gameStatus: GameStatus;
  audioRef: React.RefObject<HTMLAudioElement>;
  handPositionsRef: React.MutableRefObject<any>;
  chart: NoteData[];
  onNoteHit: (note: NoteData, goodCut: boolean) => void;
  onNoteMiss: (note: NoteData) => void;
  onSongEnd: () => void;
  multiplier: number;
}

const GameScene: React.FC<GameSceneProps> = ({
  gameStatus,
  audioRef,
  handPositionsRef,
  chart,
  onNoteHit,
  onNoteMiss,
  onSongEnd,
  multiplier,
}) => {
  const [notesState, setNotesState] = useState<NoteData[]>(chart);
  const [currentTime, setCurrentTime] = useState(0);

  const activeNotesRef = useRef<NoteData[]>([]);
  const nextNoteIndexRef = useRef(0);
  const shakeIntensity = useRef(0);
  const flashIntensity = useRef(0);
  const flashColor = useRef(new THREE.Color(0, 0, 0));

  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // Systems
  const debrisSystemRef = useRef<DebrisSystemHandle>(null);
  const shockwaveSystemRef = useRef<ShockwaveSystemHandle>(null);

  // Scene Element Refs
  const leftStripRef = useRef<THREE.Mesh>(null);
  const rightStripRef = useRef<THREE.Mesh>(null);
  const topLeftStripRef = useRef<THREE.Mesh>(null);
  const topRightStripRef = useRef<THREE.Mesh>(null);

  const gridMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const tunnelRef = useRef<THREE.Mesh>(null);
  const tunnelMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const laserGridRef = useRef<THREE.Mesh>(null);

  const { scene } = useThree();
  const vecA = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    scene.background = new THREE.Color("#000000");
    scene.fog = new THREE.Fog("#000000", 15, 60);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene]);

  useEffect(() => {
    setNotesState(chart);
    activeNotesRef.current = [];
    nextNoteIndexRef.current = 0;
  }, [chart]);

  const handleHit = (
    note: NoteData,
    goodCut: boolean,
    hitPosition: THREE.Vector3
  ) => {
    shakeIntensity.current = goodCut ? 0.3 : 0.15;

    // TRIGGER FLASH
    flashIntensity.current = 2.5;
    flashColor.current.set(note.type === "left" ? COLORS.left : COLORS.right);

    if (debrisSystemRef.current) {
      debrisSystemRef.current.explode(hitPosition, note.type);
    }
    if (shockwaveSystemRef.current) {
      shockwaveSystemRef.current.spawn(hitPosition, note.type);
    }
    onNoteHit(note, goodCut);
  };

  useFrame((state, delta) => {
    const time = audioRef.current?.currentTime || 0;

    // --- RHYTHM & AMBIENCE ---
    const beatPhase = (time % BEAT_TIME) / BEAT_TIME;
    // Sharper, stronger pulse
    const pulse = Math.pow(1 - beatPhase, 4);

    flashIntensity.current = THREE.MathUtils.lerp(
      flashIntensity.current,
      0,
      6 * delta
    );

    // Environmental Color Pulse
    const ambientColor = new THREE.Color("#050510");
    // Increased pulse effect on ambient
    ambientColor.addScalar(pulse * 0.15);
    const targetColor = ambientColor
      .clone()
      .lerp(flashColor.current, Math.min(1, flashIntensity.current));

    // Update LED Strips
    const stripIntensity = 0.5 + flashIntensity.current * 4 + pulse * 1.5;

    const updateStrip = (ref: React.RefObject<THREE.Mesh>) => {
      if (ref.current) {
        const mat = ref.current.material as THREE.MeshStandardMaterial;
        mat.color.copy(targetColor);
        mat.emissive.copy(targetColor);
        mat.emissiveIntensity = stripIntensity;
      }
    };

    updateStrip(leftStripRef);
    updateStrip(rightStripRef);
    updateStrip(topLeftStripRef);
    updateStrip(topRightStripRef);

    // Update Tunnel
    if (tunnelRef.current) {
      const scale = 1 + pulse * 0.02 + flashIntensity.current * 0.02;
      tunnelRef.current.scale.set(scale, scale, 1);
      if (tunnelMaterialRef.current) {
        tunnelMaterialRef.current.color.copy(targetColor).multiplyScalar(0.4);
        tunnelMaterialRef.current.opacity = 0.1 + pulse * 0.15;
      }
    }

    // Update Floor Grid
    if (gridMaterialRef.current) {
      gridMaterialRef.current.emissive.copy(targetColor);
      gridMaterialRef.current.emissiveIntensity = flashIntensity.current * 0.8;
    }

    // Update Laser Background Grid
    if (laserGridRef.current) {
      laserGridRef.current.position.z = -40 + Math.sin(time * 0.5) * 5;
      laserGridRef.current.rotation.z = Math.sin(time * 0.1) * 0.1;
    }

    // --- CAMERA SHAKE ---
    if (shakeIntensity.current > 0 && cameraRef.current) {
      const shake = shakeIntensity.current;
      cameraRef.current.position.x = (Math.random() - 0.5) * shake;
      cameraRef.current.position.y = 1.8 + (Math.random() - 0.5) * shake;
      shakeIntensity.current = THREE.MathUtils.lerp(
        shakeIntensity.current,
        0,
        10 * delta
      );
    }

    if (gameStatus !== GameStatus.PLAYING || !audioRef.current) return;

    setCurrentTime(time);
    if (audioRef.current.ended) {
      onSongEnd();
      return;
    }

    // --- SPAWN LOGIC ---
    const spawnAheadTime = Math.abs(SPAWN_Z - PLAYER_Z) / NOTE_SPEED;
    while (nextNoteIndexRef.current < notesState.length) {
      const nextNote = notesState[nextNoteIndexRef.current];
      if (nextNote.time - spawnAheadTime <= time) {
        activeNotesRef.current.push(nextNote);
        nextNoteIndexRef.current++;
      } else {
        break;
      }
    }

    // --- COLLISION & MOVEMENT ---
    const hands = handPositionsRef.current as HandPositions;
    for (let i = activeNotesRef.current.length - 1; i >= 0; i--) {
      const note = activeNotesRef.current[i];
      if (note.hit || note.missed) continue;

      const currentZ = PLAYER_Z - (note.time - time) * NOTE_SPEED;

      if (currentZ > MISS_Z) {
        note.missed = true;
        onNoteMiss(note);
        activeNotesRef.current.splice(i, 1);
        continue;
      }

      if (currentZ > PLAYER_Z - 1.2 && currentZ < PLAYER_Z + 1.2) {
        const handPos = note.type === "left" ? hands.left : hands.right;
        if (handPos) {
          const noteX = LANE_X_POSITIONS[note.lineIndex];
          const noteY = LAYER_Y_POSITIONS[note.lineLayer];
          const distSq =
            Math.pow(handPos.x - noteX, 2) +
            Math.pow(handPos.y - noteY, 2) +
            Math.pow(handPos.z - currentZ, 2);

          if (distSq < 1.5) {
            note.hit = true;
            note.hitTime = time;
            vecA.set(noteX, noteY, currentZ);
            handleHit(note, true, vecA.clone());
            activeNotesRef.current.splice(i, 1);
          }
        }
      }
    }
  });

  const visibleNotes = useMemo(() => {
    return notesState.filter(
      (n) =>
        !n.missed &&
        !n.hit &&
        n.time - currentTime < 5 &&
        n.time - currentTime > -2
    );
  }, [notesState, currentTime]);

  const leftHandPosRef = useRef<THREE.Vector3 | null>(null);
  const rightHandPosRef = useRef<THREE.Vector3 | null>(null);
  const leftHandVelRef = useRef<THREE.Vector3 | null>(null);
  const rightHandVelRef = useRef<THREE.Vector3 | null>(null);

  useFrame(() => {
    leftHandPosRef.current = handPositionsRef.current.left;
    rightHandPosRef.current = handPositionsRef.current.right;
    leftHandVelRef.current = handPositionsRef.current.leftVelocity;
    rightHandVelRef.current = handPositionsRef.current.rightVelocity;
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 1.8, 4]}
        fov={60}
      />
      <ambientLight intensity={0.1} />

      {/* Neon Strips */}
      <mesh
        ref={leftStripRef}
        position={[-4, 0.05, -20]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.2, 80]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh
        ref={rightStripRef}
        position={[4, 0.05, -20]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.2, 80]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh
        ref={topLeftStripRef}
        position={[-4, 4, -20]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.2, 80]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh
        ref={topRightStripRef}
        position={[4, 4, -20]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.2, 80]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* Main Tunnel */}
      <mesh
        ref={tunnelRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 2, -20]}
      >
        <cylinderGeometry args={[7, 7, 80, 12, 1, true]} />
        <meshBasicMaterial
          ref={tunnelMaterialRef}
          color="#222"
          wireframe
          side={THREE.BackSide}
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* Laser Background Grid - Lower opacity */}
      <mesh ref={laserGridRef} position={[0, 0, -40]}>
        <Grid
          args={[60, 40]}
          rotation={[Math.PI / 2, 0, 0]}
          cellColor="#000f0f"
          sectionColor="#00080a"
          cellThickness={1}
          sectionThickness={1.5}
          fadeDistance={50}
        />
      </mesh>

      <DebrisSystem ref={debrisSystemRef} />
      <ShockwaveSystem ref={shockwaveSystemRef} />

      {/* Floor Grid */}
      <Grid
        position={[0, 0, 0]}
        args={[10, 100]}
        cellThickness={0.1}
        cellColor="#333"
        sectionSize={5}
        sectionThickness={0}
        fadeDistance={40}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[10, 100]} />
        <meshStandardMaterial
          ref={gridMaterialRef}
          color="#000"
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>

      <Stars
        radius={40}
        depth={40}
        count={600}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      <Saber
        type="left"
        positionRef={leftHandPosRef}
        velocityRef={leftHandVelRef}
      />
      <Saber
        type="right"
        positionRef={rightHandPosRef}
        velocityRef={rightHandVelRef}
      />

      {visibleNotes.map((note) => (
        <Note
          key={note.id}
          data={note}
          zPos={PLAYER_Z - (note.time - currentTime) * NOTE_SPEED}
          currentTime={currentTime}
        />
      ))}
    </>
  );
};

export default GameScene;
