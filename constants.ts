/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from "three";
import { CutDirection } from "./types";

// Game World Config
export const TRACK_LENGTH = 50;
export const SPAWN_Z = -30;
export const PLAYER_Z = 0;
export const MISS_Z = 5;
export const NOTE_SPEED = 12;

export const LANE_WIDTH = 0.8;
export const LAYER_HEIGHT = 0.8;
export const NOTE_SIZE = 0.5;

// Positions for the 4 lanes (centered around 0)
// Indices: 0 (Far Left), 1 (Mid Left), 2 (Mid Right), 3 (Far Right)
export const LANE_X_POSITIONS = [
  -1.5 * LANE_WIDTH,
  -0.5 * LANE_WIDTH,
  0.5 * LANE_WIDTH,
  1.5 * LANE_WIDTH,
];
export const LAYER_Y_POSITIONS = [0.8, 1.6, 2.4]; // Low, Mid, High

// Audio - Visual Pulse Only
// Using a reliable CORS-friendly URL from Three.js examples
export const SONG_URL = "/music/song.mp3"; // Replace with your own song URL if needed
export const VISUAL_BPM = 128;
export const BEAT_TIME = 60 / VISUAL_BPM;

export const DIRECTION_VECTORS: Record<CutDirection, THREE.Vector3> = {
  [CutDirection.UP]: new THREE.Vector3(0, 1, 0),
  [CutDirection.DOWN]: new THREE.Vector3(0, -1, 0),
  [CutDirection.LEFT]: new THREE.Vector3(-1, 0, 0),
  [CutDirection.RIGHT]: new THREE.Vector3(1, 0, 0),
  [CutDirection.ANY]: new THREE.Vector3(0, 0, 0),
};
