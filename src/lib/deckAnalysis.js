import { analyzeLocalTrack } from '@/components/audio/localTrackAnalysis';
import { rememberTrackProfile } from '@/lib/trackProfile';

/** Nivelul mediu al piesei, ca Auto DJ să poată păstra energia setului. */
const meanEnergy = (structure) => {
  const bars = structure?.bars || [];
  return bars.length ? bars.reduce((sum, bar) => sum + (bar.energy || 0), 0) / bars.length : null;
};

/** Cât de deschis e sunetul (diferența medie medii–joase), pentru potrivirea timbrului. */
const meanBrightness = (structure) => {
  const bars = structure?.bars || [];
  if (!bars.length) return null;
  const low = bars.reduce((sum, bar) => sum + (bar.low || 0), 0) / bars.length;
  const mid = bars.reduce((sum, bar) => sum + (bar.mid || 0), 0) / bars.length;
  return mid - low;
};

/**
 * Analiza locală a piesei — peaks, BPM, grid de ritm și nivel mediu — rulează
 * integral în browser, fără server. Rezultatele se țin în cache, ca reluarea
 * aceleiași piese să fie instant.
 */
export function createAnalyzer({ cache, decksRef, decksStateRef, patchDeck, ramp }) {
  /**
   * Nivelare automată: aduce piesa la un nivel de referință comun (~-14 dBFS RMS),
   * ca să nu sari în volum între piese. Se aplică separat de trim-ul manual,
   * deci reglajul utilizatorului rămâne intact și se înmulțește cu el.
   */
  const applyAutoTrim = (i, track, loudness, peaks) => {
    if (loudness == null || !isFinite(loudness)) return;
    const node = decksRef.current[i];
    if (!node || node.audio.getAttribute('src') !== track.url) return;
    // A late analysis must not suddenly turn down an already-playing rise/drop.
    // Auto DJ analyses while the deck is silent; cached normalisation applies on the next load.
    if (!node.audio.paused && node.audio.currentTime > 0.25) {
      patchDeck(i, (d) => d.track?.id === track.id ? { loudness } : {});
      return;
    }
    const peak = peaks?.length ? Math.max(...peaks) : 0;
    const ceiling = peak > 0 ? Math.pow(10, -1 / 20) / peak : 2;
    const auto = Math.min(ceiling, Math.max(0.4, Math.min(2, Math.pow(10, (-14 - loudness) / 20))));
    const current = decksStateRef.current[i];
    const manual = current?.track?.id === track.id ? current.trim ?? 1 : 1;
    ramp(node.trim.gain, manual * auto, 0.3);
    patchDeck(i, (d) => (d.track && d.track.id === track.id ? { autoTrim: auto, loudness } : {}));
  };

  const analyze = async (i, track) => {
    const cached = cache.current.get(track.id);
    // O analiză veche, fără benzile noi (voce/aer/atac), se reface ca să aibă efecte corecte.
    if (cached && cached.bpmConfidence != null &&
      (cached.structure?.bars || []).every((row) => row.mid != null && row.air != null)) {
      patchDeck(i, (d) =>
        d.track && d.track.id === track.id
          ? {
              peaks: cached.peaks,
              structure: cached.structure,
              bpm: cached.bpm,
              bpmDetected: cached.bpm,
              bpmConfidence: cached.bpmConfidence,
              beatOffset: cached.beatOffset,
              beatOffsetDetected: cached.beatOffset,
              analyzing: false,
              analysisError: null,
            }
          : {}
      );
      applyAutoTrim(i, track, cached.loudness, cached.peaks);
      rememberTrackProfile(track.id, {
        bpm: cached.bpm,
        bpmConfidence: cached.bpmConfidence,
        loudness: cached.loudness,
        energy: meanEnergy(cached.structure),
        brightness: meanBrightness(cached.structure),
      });
      return;
    }

    patchDeck(i, (d) =>
      d.track && d.track.id === track.id ? { analyzing: true, analysisError: null } : {}
    );

    try {
      const { peaks, bpm, beatOffset, loudness, bpmConfidence, structure } = await analyzeLocalTrack(
        track, () => decksRef.current[i]?.audio.getAttribute('src') === track.url
      );
      cache.current.set(track.id, { peaks, bpm, beatOffset, loudness, structure, bpmConfidence });
      patchDeck(i, (d) =>
        d.track && d.track.id === track.id
          ? {
              peaks,
              structure,
              bpm,
              bpmDetected: bpm,
              bpmConfidence,
              bpmManual: false,
              beatOffset,
              beatOffsetDetected: beatOffset,
              analyzing: false,
              analysisError: null,
            }
          : {}
      );
      applyAutoTrim(i, track, loudness, peaks);
      rememberTrackProfile(track.id, {
        bpm,
        bpmConfidence,
        loudness,
        energy: meanEnergy(structure),
        brightness: meanBrightness(structure),
      });
    } catch (e) {
      patchDeck(i, (d) =>
        d.track && d.track.id === track.id
          ? { analyzing: false, analysisError: e.name === 'AbortError' ? null : "Analiza nu a reușit pentru acest fișier." }
          : {}
      );
    }
  };

  return { analyze };
}