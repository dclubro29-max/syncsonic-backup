import { holdAudioParameter } from '@/lib/autoDjAudio';
import { createIdleEffect } from '@/components/audio/idleEffect';

/** A captured fractional beat repeats on a wet-only, finite, damped delay loop. */
export function createRhythmicRoll(ctx) {
  const input = ctx.createGain(); input.gain.value = 0;
  const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 240;
  const delay = ctx.createDelay(2); delay.delayTime.value = 0.125;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6500; tone.Q.value = 0.707;
  const feedback = ctx.createGain(); feedback.gain.value = 0;
  const wet = ctx.createGain(); wet.gain.value = 0;
  highpass.connect(delay); delay.connect(tone); tone.connect(feedback);
  const lifecycle = createIdleEffect(ctx, [[input, highpass], [feedback, delay], [tone, wet]]);
  return { input, delay, feedback, wet, lifecycle };
}

export function scheduleRhythmicRoll(roll, ctx, beat, { after = 0, division = 0.25, beats = 2, amount = 0.4 }) {
  const now = ctx.currentTime;
  const size = Math.max(0.05, Math.min(1, beat * division));
  const at = now + Math.max(size + 0.04, after);
  const end = at + Math.min(4, beats) * beat;
  if (amount > 0) roll.lifecycle.wake();
  roll.lifecycle.sleepAt(end + beat + 0.15);
  [roll.input.gain, roll.feedback.gain, roll.wet.gain, roll.delay.delayTime].forEach((p) => holdAudioParameter(p, now));
  roll.delay.delayTime.setValueAtTime(size, now);
  roll.input.gain.setValueAtTime(0, now);
  roll.input.gain.setValueAtTime(0, at - size);
  roll.input.gain.linearRampToValueAtTime(1, at - size + 0.004);
  roll.input.gain.setValueAtTime(1, at - 0.006);
  roll.input.gain.linearRampToValueAtTime(0, at);
  roll.feedback.gain.setValueAtTime(0, now);
  roll.feedback.gain.setValueAtTime(0.78, at);
  roll.feedback.gain.setValueAtTime(0.78, end);
  roll.feedback.gain.linearRampToValueAtTime(0, end + 0.05);
  roll.wet.gain.setValueAtTime(0, now);
  roll.wet.gain.setValueAtTime(0, at);
  roll.wet.gain.linearRampToValueAtTime(Math.max(0, Math.min(0.5, amount)), at + 0.02);
  roll.wet.gain.setValueAtTime(Math.max(0, Math.min(0.5, amount)), end);
  roll.wet.gain.linearRampToValueAtTime(0, end + beat);
}