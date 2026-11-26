import { holdAudioParameter } from '@/lib/autoDjAudio';
import { createRhythmicRoll, scheduleRhythmicRoll } from '@/lib/rhythmicRoll';
import { scheduleReverbSend } from '@/components/audio/reverbSend';
import { attachConvolver } from '@/components/audio/convolverIdle';
import { createIdleEffect } from '@/components/audio/idleEffect';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Independent automatic-effects stage: manual EQ, gain and FX are never overwritten. */
export function createAutoPerformance(ctx, impulse) {
  const input = ctx.createGain();
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 220;
  // Filtrul de spectacol: se închide înainte de vârf și se deschide pe vârf.
  const sweep = ctx.createBiquadFilter();
  sweep.type = 'lowpass'; sweep.frequency.value = 20000; sweep.Q.value = 0.707;
  // Aerul: un mic etaj de înalte, ca drop-urile să se deschidă fără să șuiere.
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf'; air.frequency.value = 4200; air.gain.value = 0;
  const level = ctx.createGain();
  const dry = ctx.createGain();
  const send = ctx.createGain(); send.gain.value = 0;
  const echo = ctx.createDelay(2); echo.delayTime.value = 0.25;
  // Ecou ping-pong: a doua repetiție pleacă în celălalt canal, ca la un delay
  // stereo adevărat — sună mult mai lat decât un ecou mono.
  const echo2 = ctx.createDelay(2); echo2.delayTime.value = 0.25;
  const panL = ctx.createStereoPanner(); panL.pan.value = -0.7;
  const panR = ctx.createStereoPanner(); panR.pan.value = 0.7;
  const wet = ctx.createGain(); wet.gain.value = 0;
  const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 180; highpass.Q.value = 0.707;
  const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 4800; lowpass.Q.value = 0.707;
  const feedback = ctx.createGain(); feedback.gain.value = 0;
  const output = ctx.createGain();
  const echoTone = ctx.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 20000; echoTone.Q.value = 1.1;
  const pan = ctx.createStereoPanner();
  const reverb = ctx.createConvolver();
  const reverbSend = ctx.createGain(); reverbSend.gain.value = 0;
  attachConvolver(reverbSend, reverb, impulse);
  const reverbWet = ctx.createGain(); reverbWet.gain.value = 0;
  const roll = createRhythmicRoll(ctx);
  input.connect(low); low.connect(sweep); sweep.connect(air); air.connect(level);
  level.connect(dry); dry.connect(output);
  level.connect(send); echo.connect(echoTone); echoTone.connect(wet);
  wet.connect(panL); panL.connect(pan);
  wet.connect(echo2); echo2.connect(panR); panR.connect(pan);
  echo2.connect(highpass); highpass.connect(lowpass); lowpass.connect(feedback);
  const echoLifecycle = createIdleEffect(ctx, [[send, echo], [feedback, echo], [pan, output]]);
  level.connect(reverbSend); reverbSend.connect(reverb); reverb.connect(reverbWet); reverbWet.connect(output);
  level.connect(roll.input); roll.wet.connect(output);
  return { input, output, low, sweep, air, level, dry, send, echo, echo2, panL, panR, wet, feedback,
    echoTone, pan, reverbSend, reverbWet, roll, echoLifecycle };
}

function schedule(parameter, ctx, segments, map = (v) => v) {
  const now = ctx.currentTime;
  holdAudioParameter(parameter, now);
  let held = parameter.value, end = now;
  segments.forEach(({ to, over = 0.04, after = 0 }) => {
    const start = Math.max(end, now + Math.max(0, after));
    parameter.setValueAtTime(held, start);
    held = map(to);
    end = start + Math.max(0.015, over);
    parameter.linearRampToValueAtTime(held, end);
  });
}

export function scheduleAutoPerformance(stage, ctx, plan) {
  if (!stage || !ctx || ctx.state === 'closed') return;
  if (plan.beatSeconds) {
    [stage.echo, stage.echo2].filter(Boolean).forEach((node) => {
      holdAudioParameter(node.delayTime, ctx.currentTime);
      node.delayTime.setTargetAtTime(clamp(plan.beatSeconds * 0.5, 0.06, 1.5), ctx.currentTime, 0.03);
    });
  }
  // Limitele permit și amplificare peste sunetul original, nu doar tăiere.
  if (plan.low) schedule(stage.low.gain, ctx, plan.low, (v) => clamp(v, -9, 6));
  // Sweep-ul e dat în unități 0 (deschis) … 1 (închis), ca să sune la fel de lin
  // indiferent de frecvențe; harta e exponențială, ca la filtrele DJ.
  if (plan.sweep) schedule(stage.sweep.frequency, ctx, plan.sweep, (v) => clamp(20000 * Math.pow(0.02, clamp(v, 0, 1)), 320, 20000));
  if (plan.level) schedule(stage.level.gain, ctx, plan.level, (v) => clamp(v, 0.65, 1.3));
  if (plan.air) schedule(stage.air.gain, ctx, plan.air, (v) => clamp(v, -6, 5));
  if (plan.reverb) {
    scheduleReverbSend(stage.reverbSend, ctx, plan.reverb);
    schedule(stage.reverbWet.gain, ctx, plan.reverb, (v) => clamp(v, 0, 0.45));
  }
  if (plan.pan) schedule(stage.pan.pan, ctx, plan.pan, (v) => clamp(v, -0.85, 0.85));
  if (plan.color) schedule(stage.echoTone.frequency, ctx, plan.color, (v) => 20000 * Math.pow(0.025, clamp(v, 0, 1)));
  if (plan.roll) scheduleRhythmicRoll(stage.roll, ctx, plan.beatSeconds || 0.5, plan.roll);
  if (plan.echo) {
    stage.echoLifecycle.schedule(plan.echo);
    const amount = (v) => clamp(v, 0, 0.7);
    // One linear wet control, not amount²; keep the original signal intact.
    schedule(stage.send.gain, ctx, plan.echo, amount);
    holdAudioParameter(stage.wet.gain, ctx.currentTime);
    stage.wet.gain.setTargetAtTime(0.8, ctx.currentTime, 0.015);
    holdAudioParameter(stage.dry.gain, ctx.currentTime);
    stage.dry.gain.setValueAtTime(1, ctx.currentTime);
    // Ecoul se rostogolește mai mult când accentul e puternic, dar nu scapă de sub control.
    schedule(stage.feedback.gain, ctx, plan.echo, (v) => amount(v) > 0 ? Math.min(0.55, 0.2 + amount(v) * 0.5) : 0);
  }
}

export function resetAutoPerformance(stage, ctx) {
  if (!stage || !ctx || ctx.state === 'closed') return;
  scheduleReverbSend(stage.reverbSend, ctx, [{ to: 0, over: 0.08 }]);
  stage.echoLifecycle.schedule([{ to: 0, over: 0.08 }]);
  stage.roll.lifecycle.schedule([{ to: 0, over: 0.08 }]);
  [[stage.low.gain, 0], [stage.sweep.frequency, 20000], [stage.air.gain, 0], [stage.level.gain, 1], [stage.dry.gain, 1],
    [stage.send.gain, 0], [stage.wet.gain, 0], [stage.feedback.gain, 0], [stage.pan.pan, 0],
    [stage.echoTone.frequency, 20000], [stage.reverbWet.gain, 0], [stage.roll.input.gain, 0],
    [stage.roll.feedback.gain, 0], [stage.roll.wet.gain, 0]].forEach(([parameter, to]) => {
    schedule(parameter, ctx, [{ to, over: 0.08 }]);
  });
}