import { analyzeLocalTrack } from '@/components/audio/localTrackAnalysis';
import { getTrackProfile, rememberTrackProfile } from '@/lib/trackProfile';

/**
 * Analizează o piesă din bibliotecă fără s-o încarce pe un deck, ca Auto DJ să
 * știe dinainte ce tempo are. Decodarea se face la 22 kHz — jumătate din memorie
 * și din timp — iar analiza rulează în worker, ca sunetul să nu fie atins.
 */
export async function profileTrack(track) {
  if (!track?.url || !track?.id) return null;
  if (getTrackProfile(track.id)?.bpm) return getTrackProfile(track.id);
  const { bpm, bpmConfidence, loudness, structure } = await analyzeLocalTrack(track);
  const bars = structure?.bars || [];
  const energy = bars.length ? bars.reduce((sum, bar) => sum + (bar.energy || 0), 0) / bars.length : null;
  if (!bpm) return null;
  rememberTrackProfile(track.id, { bpm, bpmConfidence, loudness, energy });
  return { bpm, bpmConfidence, loudness, energy };
}