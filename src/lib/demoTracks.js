// Piese demo generate local, fără restricții de licență.
// Sunt ritmuri simple, sintetizate în browser — utile pentru exersarea mixajului.

const SR = 44100;

function encodeWav(channels, sampleRate) {
  const numCh = channels.length;
  const len = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function makeDemoTrack({ bpm = 124, bars = 8, style = "house" }) {
  const spb = 60 / bpm;
  const total = Math.ceil(spb * 4 * bars * SR);
  const L = new Float32Array(total);
  const R = new Float32Array(total);

  const kick = (start, gain = 0.95) => {
    const dur = Math.round(0.22 * SR);
    for (let i = 0; i < dur; i++) {
      const idx = start + i;
      if (idx >= total) break;
      const t = i / SR;
      const f = 48 + 110 * Math.exp(-t * 28);
      const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 16) * gain;
      L[idx] += v;
      R[idx] += v;
    }
  };

  const hat = (start, gain = 0.22) => {
    const dur = Math.round(0.05 * SR);
    for (let i = 0; i < dur; i++) {
      const idx = start + i;
      if (idx >= total) break;
      const t = i / SR;
      const v = (Math.random() * 2 - 1) * Math.exp(-t * 90) * gain;
      L[idx] += v * 0.85;
      R[idx] += v;
    }
  };

  const bass = (start, len, freq, gain = 0.36) => {
    const dur = Math.round(len * SR);
    for (let i = 0; i < dur; i++) {
      const idx = start + i;
      if (idx >= total) break;
      const t = i / SR;
      const e = Math.min(1, t / 0.006) * Math.min(1, (dur - i) / (0.02 * SR));
      const v =
        (Math.sin(2 * Math.PI * freq * t) * 0.8 + Math.sin(4 * Math.PI * freq * t) * 0.2) * e * gain;
      L[idx] += v;
      R[idx] += v;
    }
  };

  const chord = (start, len, freqs, gain = 0.1) => {
    const dur = Math.round(len * SR);
    for (let i = 0; i < dur; i++) {
      const idx = start + i;
      if (idx >= total) break;
      const t = i / SR;
      const e = Math.min(1, t / 0.02) * Math.min(1, (dur - i) / (0.06 * SR));
      let v = 0;
      freqs.forEach((f, k) => {
        v += Math.sin(2 * Math.PI * f * t + k * 0.7);
      });
      v = (v / freqs.length) * e * gain;
      L[idx] += v * 0.75;
      R[idx] += v * 1.25;
    }
  };

  const roots =
    style === "techno"
      ? [55, 55, 58.27, 49]
      : style === "chill"
      ? [65.41, 73.42, 82.41, 61.74]
      : [55, 65.41, 73.42, 61.74];

  const at = (beatPos) => Math.round(beatPos * spb * SR);

  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * 4;
    kick(at(b0));
    kick(at(b0 + 2));
    if (style !== "chill") kick(at(b0 + 3.5), 0.55);
    for (let e = 0; e < 8; e++) hat(at(b0 + e * 0.5), e % 2 ? 0.15 : 0.24);
    const root = roots[bar % roots.length];
    bass(at(b0), spb * 1.6, root, 0.4);
    bass(at(b0 + 2), spb * 1.6, root * 1.5, 0.32);
    chord(at(b0 + 1), spb * 2, [root * 4, root * 5, root * 6], style === "chill" ? 0.13 : 0.09);
  }

  return { blob: encodeWav([L, R], SR), bpm };
}

export const DEMO_TRACKS = [
  {
    id: "demo-house",
    name: "Demo House 124",
    bpm: 124,
    style: "house",
    description: "Ritm 4/4 constant, potrivit pentru primele tranziții.",
  },
  {
    id: "demo-techno",
    name: "Demo Techno 132",
    bpm: 132,
    style: "techno",
    description: "Tempo mai rapid, kick puternic pe fiecare bătaie.",
  },
  {
    id: "demo-chill",
    name: "Demo Chill 100",
    bpm: 100,
    style: "chill",
    description: "Tempo lent, fără kick sincopat — bun pentru exersat beatmatching.",
  },
];