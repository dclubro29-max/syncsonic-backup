import { selectMusicEvents } from '@/lib/musicEvents';

const db = (power) => 10 * Math.log10(Math.max(1e-10, power));
const average = (rows, start, count, field) => {
  const slice = rows.slice(Math.max(0, start), start + count);
  return slice.reduce((sum, row) => sum + row[field], 0) / Math.max(1, slice.length);
};
const median = (values) => (values.length
  ? values.slice().sort((a, b) => a - b)[Math.floor(values.length * 0.5)]
  : null);

/**
 * Scanare spectrală locală, bătaie cu bătaie: energie totală, bass, mijloc,
 * banda vocii (300–3000 Hz), aerul (peste 3 kHz), lățimea stereo și atacul
 * (cât de percusiv e momentul). Din ele se deduc momentele în care efectele au
 * sens și cât de tare pot fi puse. Totul în browser, fără rețea și fără credite.
 */
export async function analyzeMusicStructure(buffer, bpm, offset = 0) {
  if (!bpm || buffer.duration < 30) return { events: [], bars: [], profile: null };
  const beat = 60 / bpm;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const c0 = channels[0], c1 = channels[1] || channels[0];
  // ~11 kHz după eșantionare: destul ca banda vocii și aerul să fie separate
  // corect, cu de trei ori mai puțin de procesat decât la rata originală.
  const stride = Math.max(1, Math.floor(buffer.sampleRate / 8000));
  const sampleRate = buffer.sampleRate / stride;
  const onePole = (hz) => 1 - Math.exp(-2 * Math.PI * hz / sampleRate);
  const bassA = onePole(180), midA = onePole(2400), bandA = onePole(300);
  const airA = onePole(3000), bandLowA = onePole(Math.min(3000, sampleRate * 0.45));

  // Starea filtrelor stă în afara buclei: nicio alocare per eșantion.
  const st = { bassL: 0, bassR: 0, upL: 0, upR: 0, hpLy: 0, hpLx: 0, hpRy: 0, hpRx: 0,
    bandL: 0, bandR: 0, airLy: 0, airLx: 0, airRy: 0, airRx: 0, prevL: 0, prevR: 0 };

  const beats = [];
  const count = Math.floor((buffer.duration - offset) / beat);
  for (let b = 0; b < count; b++) {
    let energy = 0, low = 0, mid = 0, vocal = 0, air = 0, side = 0, mono = 0, edge = 0, samples = 0;
    const start = Math.floor((offset + b * beat) * buffer.sampleRate);
    const end = Math.min(buffer.length, Math.floor((offset + (b + 1) * beat) * buffer.sampleRate));
    for (let s = start; s < end; s += stride) {
      const l = c0[s];
      const r = c1[s];
      energy += l * l + r * r;
      st.bassL += bassA * (l - st.bassL);
      st.bassR += bassA * (r - st.bassR);
      low += st.bassL * st.bassL + st.bassR * st.bassR;
      st.upL += midA * (l - st.upL);
      st.upR += midA * (r - st.upR);
      const mL = st.upL - st.bassL, mR = st.upR - st.bassR;
      mid += mL * mL + mR * mR;
      // Vocea: trece-sus la 300 Hz, apoi trece-jos la 3000 Hz.
      const hL = bandA * (st.hpLy + l - st.hpLx);
      st.hpLy = hL;
      st.hpLx = l;
      const hR = bandA * (st.hpRy + r - st.hpRx);
      st.hpRy = hR;
      st.hpRx = r;
      st.bandL += bandLowA * (hL - st.bandL);
      st.bandR += bandLowA * (hR - st.bandR);
      vocal += st.bandL * st.bandL + st.bandR * st.bandR;
      // Aerul (hi-hat, perii, prezență).
      const aL = airA * (st.airLy + l - st.airLx);
      st.airLy = aL;
      st.airLx = l;
      const aR = airA * (st.airRy + r - st.airRx);
      st.airRy = aR;
      st.airRx = r;
      air += aL * aL + aR * aR;
      // Lățime stereo (cât stă sunetul în afara centrului) și atac percusiv.
      const m = (l + r) * 0.5, sd = (l - r) * 0.5;
      mono += m * m;
      side += sd * sd;
      const dl = l - st.prevL, dr = r - st.prevR;
      edge += dl * dl + dr * dr;
      st.prevL = l;
      st.prevR = r;
      samples++;
    }
    const n = Math.max(1, samples);
    beats.push({
      energy: db(energy / n), low: db(low / n), mid: db(mid / n), vocal: db(vocal / n),
      air: db(air / n), edge: db(edge / n),
      width: mono > 1e-9 ? Math.min(1, Math.sqrt(side / mono)) : 0,
    });
    // Yield while analysing long files; keep playback and controls responsive.
    if (b % 64 === 63) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const bars = [];
  for (let b = 0; b + 4 <= beats.length; b += 4) {
    bars.push({
      at: offset + b * beat,
      energy: average(beats, b, 4, 'energy'), low: average(beats, b, 4, 'low'),
      mid: average(beats, b, 4, 'mid'), vocal: average(beats, b, 4, 'vocal'),
      air: average(beats, b, 4, 'air'), edge: average(beats, b, 4, 'edge'),
      width: average(beats, b, 4, 'width'),
    });
  }

  return { bars, events: selectMusicEvents(beats, bars, beat, offset), profile: summarise(bars) };
}

/**
 * Caracterul piesei, ca efectele să i se potrivească: cât de bass e, cât de
 * vocală, cât de deschisă la înalte, cât de largă stereo și cât de dinamică.
 * Valorile de bandă sunt relative la energia totală, deci nu depind de mastering.
 */
function summarise(bars) {
  if (!bars.length) return null;
  const rel = (key) => median(bars
    .map((row) => (Number.isFinite(row[key]) ? row[key] - row.energy : null))
    .filter((value) => value != null && value > -90));
  const energies = bars.map((row) => row.energy).sort((a, b) => a - b);
  const lowEnd = energies[Math.floor(energies.length * 0.1)] ?? -40;
  const highEnd = energies[Math.floor(energies.length * 0.9)] ?? -20;
  return {
    bass: rel('low'), mid: rel('mid'), vocal: rel('vocal'), air: rel('air'),
    width: median(bars.map((row) => row.width).filter(Number.isFinite)),
    dynamic: Math.max(0, highEnd - lowEnd),
  };
}