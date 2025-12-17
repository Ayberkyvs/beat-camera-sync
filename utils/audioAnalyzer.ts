import { NoteData, CutDirection, HandType } from "../types";

const MIN_NOTE_GAP = 0.12;

export const analyzeAudioAndGenerateChart = async (
  audioUrl: string
): Promise<NoteData[]> => {
  try {
    const res = await fetch(audioUrl);
    const buffer = await res.arrayBuffer();

    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(buffer);

    const data = audio.getChannelData(0);
    const sampleRate = audio.sampleRate;

    const windowSize = 2048;
    const hopSize = 512;

    const energyHistory: number[] = [];
    const fluxHistory: number[] = [];
    const historySize = 50;

    let lastNoteTime = 0;
    let lastHand: HandType = "right";
    let id = 0;

    const notes: NoteData[] = [];
    let prevSpectrum: number[] | null = null;

    for (let i = 0; i < data.length - windowSize; i += hopSize) {
      const frame = data.slice(i, i + windowSize);

      // --- RMS ---
      const rms = Math.sqrt(
        frame.reduce((s, v) => s + v * v, 0) / frame.length
      );

      // --- LOW FREQ SPECTRUM (speech killer) ---
      const spectrum: number[] = [];
      for (let j = 0; j < 40; j++) {
        spectrum[j] = Math.abs(frame[j * 4] || 0);
      }

      // --- Spectral Flux ---
      let flux = 0;
      if (prevSpectrum) {
        for (let j = 0; j < spectrum.length; j++) {
          const diff = spectrum[j] - prevSpectrum[j];
          if (diff > 0) flux += diff;
        }
      }
      prevSpectrum = spectrum;

      // --- History ---
      energyHistory.push(rms);
      fluxHistory.push(flux);
      if (energyHistory.length > historySize) energyHistory.shift();
      if (fluxHistory.length > historySize) fluxHistory.shift();

      const avgEnergy =
        energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
      const avgFlux =
        fluxHistory.reduce((a, b) => a + b, 0) / fluxHistory.length;

      const time = i / sampleRate;

      // --- HARD SPEECH FILTER ---
      if (rms < 0.06) continue;
      if (flux < rms * 0.6) continue;

      // --- Beat Decision ---
      const isBeat =
        rms > avgEnergy * 1.15 &&
        flux > avgFlux * 2.2 &&
        time - lastNoteTime > MIN_NOTE_GAP;

      if (!isBeat) continue;

      const intensity = rms / avgEnergy;
      const isStream = time - lastNoteTime < 0.22;

      let type: HandType;
      let direction: CutDirection;
      let lineIndex = 1;
      let lineLayer = 0;

      if (isStream) {
        type = lastHand === "left" ? "right" : "left";
        direction = CutDirection.DOWN;
        lineIndex = type === "left" ? 1 : 2;
      } else {
        type = intensity > 1.4 ? "right" : "left";
        if (type === lastHand) {
          type = type === "left" ? "right" : "left";
        }

        if (intensity > 2.0) {
          direction = CutDirection.DOWN;
          lineIndex = type === "left" ? 1 : 2;
        } else if (intensity > 1.3) {
          direction = CutDirection.UP;
          lineIndex = type === "left" ? 1 : 2;
        } else {
          direction = CutDirection.ANY;
          lineLayer = 1;
          lineIndex = type === "left" ? 0 : 3;
        }
      }

      notes.push({
        id: `note-${id++}`,
        time,
        lineIndex,
        lineLayer,
        type,
        cutDirection: direction,
      });

      lastNoteTime = time;
      lastHand = type;
    }

    return notes.filter((n) => n.time > 1.8);
  } catch (e) {
    console.error(e);
    return [];
  }
};
