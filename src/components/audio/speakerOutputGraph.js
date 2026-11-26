import { getBand } from '@/lib/bands';
import { createSpeakerPlayback } from '@/components/audio/speakerPlayback';

/** Build one output; selection, persistence and lifecycle remain with the mixer. */
export default function createSpeakerOutput(ctx, post, deviceId, { delay, band, volume, direct, deferStart }) {
  const delayNode = ctx.createDelay(1);
  delayNode.delayTime.value = Math.min(0.999, delay / 1000);
  const spec = getBand(band);
  const bandGain = ctx.createGain();
  bandGain.gain.value = spec.gain;
  const filterA = ctx.createBiquadFilter();
  filterA.type = spec.a.type;
  filterA.frequency.value = spec.a.freq;
  if (spec.a.q) filterA.Q.value = spec.a.q;
  const filterB = ctx.createBiquadFilter();
  filterB.type = spec.b.type;
  filterB.frequency.value = spec.b.freq;
  if (spec.b.q) filterB.Q.value = spec.b.q;
  const outGain = ctx.createGain();
  outGain.gain.value = 1;
  const volumeGain = ctx.createGain();
  volumeGain.gain.value = volume;
  // Nivelul de intrare în ramură (după filtre, înainte de volumul aplicației).
  const branchAnalyser = ctx.createAnalyser();
  branchAnalyser.fftSize = 256;
  branchAnalyser.smoothingTimeConstant = 0.55;
  // Nivelul de ieșire, după volumul aplicației, înainte de ieșirea fizică.
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.55;
  // Semnalul de test intră în delayNode, exact pe ramura prin care trece muzica.
  post.connect(bandGain);
  bandGain.connect(filterA);
  filterA.connect(filterB);
  filterB.connect(delayNode);
  delayNode.connect(branchAnalyser);
  branchAnalyser.connect(outGain);
  outGain.connect(volumeGain);
  volumeGain.connect(analyser);
  const playback = createSpeakerPlayback(ctx, volumeGain, deviceId, { direct, deferStart });
  return { deviceId, bandGain, filterA, filterB, delayNode, branchAnalyser, outGain, volumeGain, analyser,
    volume, playback, delay, band };
}