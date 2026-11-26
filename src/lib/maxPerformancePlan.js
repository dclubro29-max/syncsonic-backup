const seg = (to, over, after = 0) => ({ to, over, after });
const strength = (value) => Math.max(0.2, Math.min(1, value));

/** Rotate actual DSP recipes, not random volume cuts. Dry remains unity. */
export function planMaxPhrase(beat, intensity, wait, variant = 0, synchronised = true) {
  const k = strength(intensity), at = Math.max(beat + 0.04, wait);
  const type = synchronised ? variant % 4 : variant % 2;
  const plan = { beatSeconds: beat, level: [seg(1, 0.02)], sweep: [seg(0, 0.02)],
    low: [seg(0, 0.02)], echo: [seg(0, 0.02)], reverb: [seg(0, 0.02)], pan: [seg(0, 0.02)], color: [seg(0, 0.02)] };
  const labels = ['Ecou stânga / dreapta', 'Reverb de accent', 'Roll ¼ beat', 'Filtru pe ecou'];
  if (type === 0 || type === 3) {
    plan.echo = [seg(0, 0.02), seg(0.62 * k, 0.04, at), seg(0, beat * 2, at + beat * 2)];
    plan.pan = [seg(-0.8, 0.04, at), seg(0.8, beat, at + beat * 0.5), seg(-0.8, beat, at + beat * 1.5), seg(0, beat, at + beat * 2.5)];
    if (type === 3) plan.color = [seg(0.7, 0.05, at), seg(0, beat * 3, at + beat)];
  } else if (type === 1) {
    plan.reverb = [seg(0, 0.02), seg(0.4 * k, 0.04, at), seg(0, beat * 3, at + beat)];
    plan.echo = [seg(0, 0.02), seg(0.2 * k, 0.04, at), seg(0, beat * 2, at + beat)];
  } else plan.roll = { after: at, division: 0.25, beats: 2, amount: 0.48 * k };
  return { ...plan, label: synchronised ? labels[type] : `${labels[type]} · BPM incert`, releaseAfter: at + beat * 7 };
}

export function planMaxPeak(event, source, rate, bpm, intensity) {
  const beat = 60 / (bpm * rate);
  let at = Math.max(0.02, (event.at - source) / rate);
  if (at < beat + 0.04) at += Math.ceil((beat + 0.04 - at) / beat) * beat;
  const k = strength(intensity) * (event.confidence ?? 0.7);
  const plan = planMaxPhrase(beat, intensity, at, 0);
  plan.label = event.kind === 'drop' ? 'Drop · bass + roll + ecou stereo' : 'Vârf · bass + ecou stereo + reverb';
  plan.low = [seg(0, 0.02), seg((event.kind === 'drop' ? 2.2 : 1.2) * k, 0.04, at), seg(0, beat * 4, at + beat * 2)];
  plan.reverb = [seg(0, 0.02), seg(0.22 * k, 0.04, at), seg(0, beat * 3, at + beat)];
  if (event.kind === 'drop') plan.roll = { after: at, division: 0.5, beats: 1, amount: 0.35 * k };
  return plan;
}