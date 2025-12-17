/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import * as THREE from "three";

const mapHandToWorld = (x: number, y: number): THREE.Vector3 => {
  const GAME_X_RANGE = 5;
  const GAME_Y_RANGE = 3.5;
  const Y_OFFSET = 0.8;

  const worldX = (0.5 - x) * GAME_X_RANGE;
  const worldY = (1.0 - y) * GAME_Y_RANGE - GAME_Y_RANGE / 2 + Y_OFFSET;
  const worldZ = -Math.max(0, worldY * 0.2);

  return new THREE.Vector3(worldX, Math.max(0.1, worldY), worldZ);
};

export const useMediaPipe = (
  videoRef: React.RefObject<HTMLVideoElement | null>
) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for gesture
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);

  const handPositionsRef = useRef<{
    left: THREE.Vector3 | null;
    right: THREE.Vector3 | null;
    lastLeft: THREE.Vector3 | null;
    lastRight: THREE.Vector3 | null;
    leftVelocity: THREE.Vector3;
    rightVelocity: THREE.Vector3;
    lastTimestamp: number;
  }>({
    left: null,
    right: null,
    lastLeft: null,
    lastRight: null,
    leftVelocity: new THREE.Vector3(0, 0, 0),
    rightVelocity: new THREE.Vector3(0, 0, 0),
    lastTimestamp: 0,
  });

  const lastResultsRef = useRef<HandLandmarkerResult | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let isActive = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );

        if (!isActive) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (!isActive) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        startCamera();
      } catch (err: any) {
        console.error("Error initializing MediaPipe:", err);
        setError(`Failed to load hand tracking: ${err.message}`);
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            if (isActive) {
              setIsCameraReady(true);
              predictWebcam();
            }
          };
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setError("Could not access camera.");
      }
    };

    const predictWebcam = () => {
      if (!videoRef.current || !landmarkerRef.current || !isActive) return;

      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        let startTimeMs = performance.now();
        try {
          const results = landmarkerRef.current.detectForVideo(
            video,
            startTimeMs
          );
          lastResultsRef.current = results;
          processResults(results);
          detectGestures(results);
        } catch (e) {
          console.warn("Detection failed this frame", e);
        }
      }

      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    const detectGestures = (results: HandLandmarkerResult) => {
      if (!results.landmarks) return;

      for (const landmarks of results.landmarks) {
        // Finger Tips
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        // Finger PIPs (Knuckles - to check if curled)
        const indexPip = landmarks[6];
        const middlePip = landmarks[10];
        const ringPip = landmarks[14];
        const pinkyPip = landmarks[18];

        // STRICTER Middle Finger Logic
        // 1. Middle finger extended: Tip must be SIGNIFICANTLY higher (lower Y) than PIP.
        // 2. Other fingers curled: Tips must be lower (higher Y) than PIPs.
        // 3. Middle finger tip must be the highest point (lowest Y) among all tips.

        const EXTENSION_THRESHOLD = 0.05; // Amount tip needs to be above PIP to count as extended
        const CURL_TOLERANCE = 0.02; // Amount tip can be above PIP and still count as curled (relaxed hand)

        const isMiddleExtended =
          middleTip.y < middlePip.y - EXTENSION_THRESHOLD;

        const isIndexCurled = indexTip.y > indexPip.y - CURL_TOLERANCE;
        const isRingCurled = ringTip.y > ringPip.y - CURL_TOLERANCE;
        const isPinkyCurled = pinkyTip.y > pinkyPip.y - CURL_TOLERANCE;

        const isMiddleHighest =
          middleTip.y < indexTip.y &&
          middleTip.y < ringTip.y &&
          middleTip.y < pinkyTip.y;

        if (
          isMiddleExtended &&
          isIndexCurled &&
          isRingCurled &&
          isPinkyCurled &&
          isMiddleHighest
        ) {
          setDetectedGesture("MIDDLE_FINGER");
          // Clear after 2 seconds
          setTimeout(() => setDetectedGesture(null), 2000);
          return;
        }
      }
    };

    const processResults = (results: HandLandmarkerResult) => {
      const now = performance.now();
      const deltaTime = (now - handPositionsRef.current.lastTimestamp) / 1000;
      handPositionsRef.current.lastTimestamp = now;

      let newLeft: THREE.Vector3 | null = null;
      let newRight: THREE.Vector3 | null = null;

      if (results.landmarks) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const classification = results.handedness[i][0];
          const isRight = classification.categoryName === "Right";

          const tip = landmarks[8];
          const worldPos = mapHandToWorld(tip.x, tip.y);

          if (isRight) {
            newRight = worldPos;
          } else {
            newLeft = worldPos;
          }
        }
      }

      // --- Low Latency Logic ---
      const s = handPositionsRef.current;

      const updateHand = (
        currentPos: THREE.Vector3 | null,
        newPos: THREE.Vector3 | null,
        velocity: THREE.Vector3,
        lastPos: THREE.Vector3 | null
      ): [THREE.Vector3 | null, THREE.Vector3 | null] => {
        if (!newPos) return [null, lastPos];

        if (!currentPos) {
          return [newPos.clone(), newPos.clone()];
        }

        const dist = newPos.distanceTo(currentPos);
        const speed = dist / (deltaTime || 0.016);
        const lerpFactor = THREE.MathUtils.clamp(speed * 0.25, 0.4, 0.9);

        const smoothedPos = currentPos.clone().lerp(newPos, lerpFactor);

        if (deltaTime > 0.001) {
          velocity.subVectors(smoothedPos, currentPos).divideScalar(deltaTime);
        }

        return [smoothedPos, currentPos.clone()];
      };

      const [smoothedLeft, lastLeft] = updateHand(
        s.left,
        newLeft,
        s.leftVelocity,
        s.lastLeft
      );
      s.left = smoothedLeft;
      if (lastLeft) s.lastLeft = lastLeft;

      const [smoothedRight, lastRight] = updateHand(
        s.right,
        newRight,
        s.rightVelocity,
        s.lastRight
      );
      s.right = smoothedRight;
      if (lastRight) s.lastRight = lastRight;
    };

    setupMediaPipe();

    return () => {
      isActive = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [videoRef]);

  return {
    isCameraReady,
    handPositionsRef,
    lastResultsRef,
    error,
    detectedGesture,
  };
};
