/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { GameStatus, NoteData, COLORS } from "./types";
import { SONG_URL } from "./constants";
import { useMediaPipe } from "./hooks/useMediaPipe";
import { analyzeAudioAndGenerateChart } from "./utils/audioAnalyzer";
import GameScene from "./components/GameScene";
import WebcamPreview from "./components/WebcamPreview";
import {
  Play,
  RefreshCw,
  VideoOff,
  Hand,
  Sparkles,
  Upload,
  Music,
  AlertTriangle,
  Focus,
} from "lucide-react";

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [health, setHealth] = useState(100);
  const [analyzing, setAnalyzing] = useState(false);

  // Custom Song State
  const [songUrl, setSongUrl] = useState<string>(SONG_URL);
  const [currentChart, setCurrentChart] = useState<NoteData[]>([]);
  const [isCustomSong, setIsCustomSong] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audioRef = useRef<HTMLAudioElement>(new Audio(SONG_URL));
  const videoRef = useRef<HTMLVideoElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const {
    isCameraReady,
    handPositionsRef,
    lastResultsRef,
    error: cameraError,
    detectedGesture,
  } = useMediaPipe(videoRef);

  // Initial Analysis
  useEffect(() => {
    const initAudio = async () => {
      setAnalyzing(true);
      const notes = await analyzeAudioAndGenerateChart(SONG_URL);
      setCurrentChart(notes);
      setAnalyzing(false);
      setGameStatus(GameStatus.IDLE);
    };
    if (gameStatus === GameStatus.LOADING) {
      initAudio();
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = songUrl;
      audioRef.current.load();
    }
  }, [songUrl]);

  // Handle Middle Finger
  useEffect(() => {
    if (detectedGesture === "MIDDLE_FINGER" && flashRef.current) {
      // Show a funny message or giant emoji
      const el = document.getElementById("gesture-overlay");
      if (el) {
        el.style.opacity = "1";
        el.style.transform = "scale(1.2)";
        setTimeout(() => {
          el.style.opacity = "0";
          el.style.transform = "scale(0.5)";
        }, 1500);
      }
    }
  }, [detectedGesture]);

  const triggerFlash = (color: string) => {
    if (flashRef.current) {
      flashRef.current.style.backgroundImage = `radial-gradient(circle at center, transparent 40%, ${color} 100%)`;
      flashRef.current.style.opacity = "0.6";
      setTimeout(() => {
        if (flashRef.current) flashRef.current.style.opacity = "0";
      }, 150);
    }
  };

  const handleNoteHit = useCallback(
    (note: NoteData, goodCut: boolean) => {
      let points = 100;
      if (goodCut) points += 50;

      triggerFlash(note.type === "left" ? COLORS.left : COLORS.right);

      if (navigator.vibrate) {
        navigator.vibrate(goodCut ? 40 : 20);
      }

      setCombo((c) => {
        const newCombo = c + 1;
        if (newCombo > 30) setMultiplier(8);
        else if (newCombo > 20) setMultiplier(4);
        else if (newCombo > 10) setMultiplier(2);
        else setMultiplier(1);
        return newCombo;
      });

      setScore((s) => s + points * multiplier);
      setHealth((h) => Math.min(100, h + 2));
    },
    [multiplier]
  );

  const handleNoteMiss = useCallback((note: NoteData) => {
    setCombo(0);
    setMultiplier(1);

    if (flashRef.current) {
      flashRef.current.style.backgroundImage = `radial-gradient(circle at center, transparent 20%, #ff0000 100%)`;
      flashRef.current.style.opacity = "0.8";
      setTimeout(() => {
        if (flashRef.current) flashRef.current.style.opacity = "0";
      }, 300);
    }

    setHealth((h) => {
      const newHealth = h - 15;
      if (newHealth <= 0) {
        setTimeout(() => endGame(false), 0);
        return 0;
      }
      return newHealth;
    });
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setGameStatus(GameStatus.LOADING); // Show loading UI

    const objectUrl = URL.createObjectURL(file);
    setSongUrl(objectUrl);
    setIsCustomSong(true);

    // Analyze new file
    const notes = await analyzeAudioAndGenerateChart(objectUrl);
    setCurrentChart(notes);

    setAnalyzing(false);
    setGameStatus(GameStatus.IDLE);
  };

  const startGame = async () => {
    if (!isCameraReady || analyzing) return;

    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setHealth(100);

    currentChart.forEach((n) => {
      n.hit = false;
      n.missed = false;
    });

    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        setGameStatus(GameStatus.PLAYING);
      }
    } catch (e) {
      console.error("Audio play failed", e);
      alert("Could not start audio. Please interact with the page first.");
    }
  };

  const endGame = (victory: boolean) => {
    setGameStatus(victory ? GameStatus.VICTORY : GameStatus.GAME_OVER);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#050510] overflow-hidden font-sans select-none">
      {/* Gesture Easter Egg Overlay */}
      <div
        id="gesture-overlay"
        className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center transition-all duration-300 opacity-0 transform scale-50"
      >
        <div className="text-9xl filter drop-shadow-[0_0_50px_rgba(255,0,0,0.8)] animate-bounce">
          🖕
        </div>
        <p className="absolute mt-40 text-red-500 font-bold text-2xl bg-black/50 px-4 py-2 rounded">
          NICE TRY!
        </p>
      </div>

      {/* Screen Flash */}
      <div
        ref={flashRef}
        className="absolute inset-0 z-20 pointer-events-none opacity-0 transition-opacity duration-150 ease-out"
        style={{ mixBlendMode: "screen" }}
      />

      <video
        ref={videoRef}
        className="absolute opacity-0 pointer-events-none"
        playsInline
        muted
        autoPlay
        style={{ width: "640px", height: "480px" }}
      />

      <input
        type="file"
        accept="audio/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      <Canvas shadows dpr={[1, 2]}>
        {gameStatus !== GameStatus.LOADING && (
          <GameScene
            gameStatus={gameStatus}
            audioRef={audioRef}
            handPositionsRef={handPositionsRef}
            chart={currentChart}
            onNoteHit={handleNoteHit}
            onNoteMiss={handleNoteMiss}
            onSongEnd={() => endGame(true)}
            multiplier={multiplier}
          />
        )}
      </Canvas>

      <WebcamPreview
        videoRef={videoRef}
        resultsRef={lastResultsRef}
        isCameraReady={isCameraReady}
      />

      {/* Modern UI Layer */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-30">
        {/* HUD Top Bar */}
        <div className="flex justify-between items-start w-full">
          {/* Health Bar */}
          <div className="w-64 backdrop-blur-md bg-black/40 p-3 rounded-xl border border-white/10 shadow-lg">
            <div className="flex justify-between text-xs text-blue-200 mb-1 font-bold tracking-wider">
              <span>SYSTEM INTEGRITY</span>
              <span>{Math.floor(health)}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out shadow-[0_0_10px_currentColor] ${health > 50 ? "bg-gradient-to-r from-green-500 to-green-300 text-green-400" : health > 20 ? "bg-gradient-to-r from-yellow-500 to-yellow-300 text-yellow-400" : "bg-gradient-to-r from-red-600 to-red-500 text-red-500 animate-pulse"}`}
                style={{ width: `${health}%` }}
              />
            </div>
          </div>

          {/* Score & Combo */}
          <div className="flex flex-col items-center">
            <div className="text-5xl pr-4 font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">
              {score.toLocaleString()}
            </div>

            <div
              className={`mt-2 transition-transform duration-100 ${combo > 0 ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
            >
              <div className="text-3xl font-bold text-blue-300 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                {combo}x
              </div>
            </div>

            {multiplier > 1 && (
              <div className="mt-1 px-4 py-1 bg-blue-600/20 border border-blue-400/50 rounded-full text-blue-300 text-xs font-bold uppercase tracking-widest animate-pulse">
                Multiplier {multiplier}x
              </div>
            )}
          </div>

          {/* Song Info */}
          <div className="w-fit px-4 flex flex-col items-end backdrop-blur-md bg-black/40 p-3 rounded-xl border border-white/10 shadow-lg text-right">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
              <Music className="size-6" />
              <span className="truncate max-w-[150px]">
                {isCustomSong ? "Custom Track" : "Rice Racer (Demo)"}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {analyzing
                ? "Analyzing Beats..."
                : `${currentChart.length} Notes Generated`}
            </div>
          </div>
        </div>
        <div className="flex gap-3 top-0">
          <a
            href="https://carpediem.hr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <img src="/assets/logo_white.png" className="w-[100px]" />
          </a>
          <img
            src="/assets/karlovacka.png"
            className="w-[100px] bg-white/80 backdrop-blur-lg p-2 rounded"
          />
          <a
            href="https://ayberkyavas.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <img src="/assets/logo_embed.png" className="w-[80px] srounded" />
          </a>
        </div>
        {/* Menus */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          {(gameStatus === GameStatus.LOADING || analyzing) && (
            <div className="bg-black/80 backdrop-blur-xl p-12 rounded-3xl border border-blue-500/20 flex flex-col items-center shadow-2xl">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-r-4 border-purple-500 rounded-full animate-spin reverse-spin"></div>
              </div>
              <h2 className="text-3xl text-white font-bold mb-2 tracking-widest">
                ANALYZING AUDIO
              </h2>
              <p className="text-blue-300/70 animate-pulse">
                Generating Beat Map...
              </p>
            </div>
          )}

          {gameStatus === GameStatus.IDLE && !analyzing && (
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative bg-black/80 p-12 rounded-3xl text-center border border-white/10 backdrop-blur-2xl max-w-lg shadow-2xl">
                <div className="mb-8 flex justify-center">
                  <div className="p-4 bg-gradient-to-tr from-blue-900/50 to-purple-900/50 rounded-2xl border border-white/5">
                    <Focus className="w-16 h-16 text-blue-400 filter drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                  </div>
                </div>

                <h1 className="text-6xl font-black text-white mb-2 tracking-tighter italic">
                  TEMPO{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    STRIKE
                  </span>
                </h1>
                <p className="text-gray-400 text-sm tracking-widest uppercase mb-8">
                  Beat & Camera Synchronization System
                </p>

                <div className="space-y-3 text-gray-300 mb-10 text-left bg-white/5 p-6 rounded-xl border border-white/5">
                  <p className="flex items-center gap-3">
                    <Hand className="w-5 h-5 text-blue-400" />
                    <span>Step back until hands are tracked.</span>
                  </p>
                  <p className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-red-500 flex items-center justify-center text-[10px] font-bold text-black">
                      L
                    </div>
                    <span>
                      Left Hand cuts <span className="text-red-400">Red</span>
                    </span>
                  </p>
                  <p className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px] font-bold text-black">
                      R
                    </div>
                    <span>
                      Right Hand cuts{" "}
                      <span className="text-blue-400">Blue</span>
                    </span>
                  </p>
                </div>

                {!isCameraReady ? (
                  <div className="flex items-center justify-center text-red-400 gap-2 bg-red-950/30 p-4 rounded-lg border border-red-500/20 animate-pulse">
                    <VideoOff /> Initializing Tracking System...
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={startGame}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold py-5 px-12 rounded-xl transition-all transform hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-3 active:scale-95"
                    >
                      <Play fill="currentColor" /> INITIATE SEQUENCE
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-transparent hover:bg-white/5 text-gray-300 text-lg font-semibold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/20 hover:border-white/40"
                    >
                      <Upload size={20} />
                      {isCustomSong
                        ? "Select Different Track"
                        : "Upload Custom MP3"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {(gameStatus === GameStatus.GAME_OVER ||
            gameStatus === GameStatus.VICTORY) && (
            <div className="bg-black/90 p-14 rounded-3xl text-center border border-white/10 backdrop-blur-2xl shadow-[0_0_100px_rgba(0,0,0,1)]">
              <div className="mb-6">
                {gameStatus === GameStatus.VICTORY ? (
                  <div className="text-green-400 flex justify-center">
                    <Sparkles size={64} />
                  </div>
                ) : (
                  <div className="text-red-500 flex justify-center">
                    <AlertTriangle size={64} />
                  </div>
                )}
              </div>

              <h2
                className={`text-6xl font-black mb-2 tracking-tighter ${gameStatus === GameStatus.VICTORY ? "text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600" : "text-red-500"}`}
              >
                {gameStatus === GameStatus.VICTORY
                  ? "MISSION COMPLETE"
                  : "CRITICAL FAILURE"}
              </h2>

              <div className="my-8 py-8 border-t border-b border-white/10">
                <p className="text-gray-100 text-sm uppercase tracking-widest mb-2 max-w-lg">
                  {gameStatus === GameStatus.VICTORY
                    ? "„Ha! Pogledajte tko je uspio doći ovako daleko – stvarno ste nas iznenadili! Ali dobro, moramo priznati… uspješno ste riješili igru! Čestitamo… ili barem pokušaj čestitke. Ako želite pronaći listu dobrih i zločestih, morat ćete se potruditi još malo. Poklon koji krije trag možete rastaviti – šerafi, vijci, dijelovi… sve to stoji između vas i našeg malog blaga. Ne očekujte da će biti lako, Djed Mraz nas nikad ne shvaća ozbiljno, a ni mi vas. Pa, pokažite svoje vještine – ho, ho… ha!“"
                    : "„Ha, ha! Misliš da si nas prestigao? Nema šanse! Ako stvarno želiš doći do liste, moraš nastaviti dalje… poklon čeka, ali samo za one koji se potrude. Ho, ho… ha!“"}
                </p>

                <div className="flex flex-col items-center mt-8">
                  <p className="text-gray-400 text-sm uppercase tracking-widest">
                    Final Score
                  </p>
                  <p className="text-5xl font-mono font-bold text-white">
                    {score.toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setGameStatus(GameStatus.IDLE)}
                className="bg-white hover:bg-gray-200 text-black text-xl font-bold py-4 px-10 rounded-full flex items-center justify-center mx-auto gap-3 transition-colors shadow-lg hover:shadow-white/20"
              >
                <RefreshCw /> RESTART SYSTEM
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
