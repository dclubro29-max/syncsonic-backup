/**
 * Lanțul audio al unui deck, construit din noduri Web Audio native.
 *
 *   sursă -> trim -> EQ (bass/mid/high) -> filtru -> volum
 *         -> [dry | ecou stereo amortizat | reverb cu predelay] -> spectacol -> analizor
 *
 * Ecoul are două linii (stânga/dreapta) cu feedback încrucișat și un filtru
 * care închide înaltele la fiecare repetare: coada sună ca într-o sală, nu ca
 * o buclă digitală. Reverbul primește un predelay scurt și un filtru trece-sus,
 * ca să nu murdărească bassul.
 *
 * Trim-ul e separat de volum ca să poată primi nivelarea automată a piesei
 * fără să atingă reglajul de volum al utilizatorului.
 */
import { createAutoPerformance, resetAutoPerformance } from '@/lib/autoPerformanceGraph';
import { holdAudioParameter } from '@/lib/autoDjAudio';
import { scheduleReverbSend } from '@/components/audio/reverbSend';
import { attachConvolver } from '@/components/audio/convolverIdle';
import { createIdleEffect } from '@/components/audio/idleEffect';

/** Aduce un deck la starea neutră: EQ și efecte pe zero, filtru deschis, tempo 1. */
export function resetDeckNode(node, ramp, volume = 0.8) {
  resetAutoPerformance(node.performance, node.gain.context);
  [node.trim.gain, node.low.gain, node.mid.gain, node.high.gain, node.gain.gain,
    node.echoWet.gain, node.echoFb.gain, node.reverbWet.gain, node.filter.frequency,
    node.echoDamp.frequency, node.karDry.gain, node.karWet.gain, node.karR.gain].forEach((p) =>
    holdAudioParameter(p, node.gain.context.currentTime));
  ramp(node.trim.gain, 1);
  ramp(node.low.gain, 0);
  ramp(node.mid.gain, 0);
  ramp(node.high.gain, 0);
  ramp(node.gain.gain, volume);
  if (node.emergencyGain) ramp(node.emergencyGain.gain, Math.max(0, Math.min(1, volume)));
  if (node.filter.type !== "allpass") node.filter.type = "allpass";
  ramp(node.filter.frequency, 20000, 0.05);
  node.echoLifecycle.schedule([{ to: 0, over: 0.03 }]);
  ramp(node.echoWet.gain, 0);
  ramp(node.echoFb.gain, 0);
  ramp(node.reverbWet.gain, 0);
  scheduleReverbSend(node.revSend, node.gain.context, [{ to: 0, over: 0.03 }]);
  ramp(node.echoDamp.frequency, 3600, 0.05);
  ramp(node.karDry.gain, 1);
  ramp(node.karWet.gain, 0);
  ramp(node.karR.gain, 0);
  if (node.audio.playbackRate !== 1) node.audio.playbackRate = 1;
}

/** Neutral depends on topology: a high-pass opens at 20 Hz, not 20 kHz. */
export function deckFilterFrequency(value, type) {
  if (Math.abs(value) < 0.02) return type === 'highpass' ? 20 : 20000;
  return value < 0 ? 20000 * Math.pow(0.01, -value) : 20 * Math.pow(200, value);
}

/** Filtru de deck: 0 = deschis, negativ = low-pass, pozitiv = high-pass. */
export function applyDeckFilter(node, ramp, value) {
  const f = node.filter;
  if (Math.abs(value) < 0.02) {
    if (f.type !== "allpass") f.type = "allpass";
    ramp(f.frequency, 20000, 0.05);
  } else if (value < 0) {
    if (f.type !== "lowpass") f.type = "lowpass";
    ramp(f.frequency, 20000 * Math.pow(0.01, -value), 0.05);
  } else {
    if (f.type !== "highpass") f.type = "highpass";
    ramp(f.frequency, 20 * Math.pow(200, value), 0.05);
  }
}

/** Reaplică pe noduri reglajele din starea deck-ului: EQ, efecte, trim, tempo. */
export function applyDeckState(node, ramp, deck, { keepTempo = false } = {}) {
  ramp(node.low.gain, deck.eq.low);
  ramp(node.mid.gain, deck.eq.mid);
  ramp(node.high.gain, deck.eq.high);
  node.echoLifecycle.schedule([{ to: deck.fx.echo, over: 0.03 }]);
  ramp(node.echoWet.gain, deck.fx.echo * 0.85);
  ramp(node.echoFb.gain, deck.fx.echo > 0 ? 0.15 + deck.fx.echo * 0.55 : 0);
  scheduleReverbSend(node.revSend, node.gain.context, [{ to: deck.fx.reverb, over: 0.03 }]);
  ramp(node.reverbWet.gain, deck.fx.reverb * 0.9);
  applyDeckFilter(node, ramp, deck.fx.filter);
  // Karaoke: 0 = piesa întreagă, 1 = doar diferența stereo (vocea din centru dispare).
  const karaoke = Math.max(0, Math.min(1, deck.fx.karaoke || 0));
  ramp(node.karDry.gain, 1 - karaoke);
  ramp(node.karWet.gain, karaoke);
  ramp(node.karR.gain, -karaoke);
  ramp(node.trim.gain, deck.trim * (deck.autoTrim ?? 1));
  // Reapplying tone must not flush a live pitch-preserving decoder, even briefly.
  if (!keepTempo && Math.abs(node.audio.playbackRate - deck.tempo) > 0.000001) {
    node.audio.playbackRate = deck.tempo;
  }
}

export function createDeckNode(ctx, impulse) {
  const audio = new Audio();
  audio.preload = "auto";
  // Pe telefon elementul trebuie să redea pe loc, fără player full-screen.
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  // Key lock pornit: tempo-ul se schimbă fără să se schimbe tonalitatea piesei.
  audio.preservesPitch = true;
  const src = ctx.createMediaElementSource(audio);

  const trim = ctx.createGain();
  trim.gain.value = 1;

  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 320;
  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.8;
  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 3200;

  const filter = ctx.createBiquadFilter();
  filter.type = "allpass";
  filter.frequency.value = 20000;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.value = 0.8;

  const fxOut = ctx.createGain();
  fxOut.gain.value = 1;
  const dry = ctx.createGain();
  dry.gain.value = 1;

  /* ---------------- Ecou stereo cu feedback încrucișat ---------------- */

  const echoL = ctx.createDelay(2.5);
  echoL.delayTime.value = 0.34;
  const echoR = ctx.createDelay(2.5);
  echoR.delayTime.value = 0.51;
  const echoToneL = ctx.createBiquadFilter();
  echoToneL.type = "lowpass";
  echoToneL.frequency.value = 4600;
  echoToneL.Q.value = 0.6;
  const echoToneR = ctx.createBiquadFilter();
  echoToneR.type = "lowpass";
  echoToneR.frequency.value = 3400;
  echoToneR.Q.value = 0.6;
  const echoTapL = ctx.createGain();
  echoTapL.gain.value = 0.72;
  const echoTapR = ctx.createGain();
  echoTapR.gain.value = 0.72;
  const echoPanL = ctx.createStereoPanner();
  echoPanL.pan.value = -0.55;
  const echoPanR = ctx.createStereoPanner();
  echoPanR.pan.value = 0.55;
  const echoWet = ctx.createGain();
  echoWet.gain.value = 0;
  const echoFb = ctx.createGain();
  echoFb.gain.value = 0;
  // Amortizarea din buclă: fiecare repetare pierde înaltele, ca într-o sală.
  const echoDamp = ctx.createBiquadFilter();
  echoDamp.type = "lowpass";
  echoDamp.frequency.value = 3600;
  echoDamp.Q.value = 0.5;

  /* ---------------- Reverb cu predelay și filtrare ---------------- */

  const revSend = ctx.createGain();
  revSend.gain.value = 0;
  const revPre = ctx.createDelay(0.25);
  revPre.delayTime.value = 0.014;
  const revHp = ctx.createBiquadFilter();
  revHp.type = "highpass";
  revHp.frequency.value = 190;
  revHp.Q.value = 0.6;
  const revLp = ctx.createBiquadFilter();
  revLp.type = "lowpass";
  revLp.frequency.value = 7600;
  revLp.Q.value = 0.6;
  const conv = ctx.createConvolver();
  // Reverb-ul stă oprit până e cerut: convoluția permanentă golește firul audio.
  attachConvolver(revSend, conv, impulse);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.5;

  /* ---------------- Karaoke: anularea canalului central ---------------- */

  // Vocea stă aproape mereu pe centru (egal în stânga și dreapta). Diferența
  // dintre canale o conține doar pe ea, deci scăderea unui canal din celălalt
  // lasă instrumentalul. Ieșirea rămâne mono, ca să nu se anuleze între boxe.
  const karSplit = ctx.createChannelSplitter(2);
  const karL = ctx.createGain();
  karL.gain.value = 1;
  const karR = ctx.createGain();
  karR.gain.value = 0;
  const karMerge = ctx.createChannelMerger(2);
  const karDry = ctx.createGain();
  karDry.gain.value = 1;
  const karWet = ctx.createGain();
  karWet.gain.value = 0;

  src.connect(trim);
  trim.connect(low);
  low.connect(mid);
  mid.connect(high);

  high.connect(karDry);
  karDry.connect(filter);
  high.connect(karSplit);
  karSplit.connect(karL, 0);
  karSplit.connect(karR, 1);
  karL.connect(karMerge, 0, 0);
  karL.connect(karMerge, 0, 1);
  karR.connect(karMerge, 0, 0);
  karR.connect(karMerge, 0, 1);
  karMerge.connect(karWet);
  karWet.connect(filter);
  filter.connect(gain);

  gain.connect(dry);
  dry.connect(fxOut);

  // Echo inputs, feedback returns and output connect only while the effect is audible.
  echoL.connect(echoToneL);
  echoToneL.connect(echoTapL);
  echoTapL.connect(echoPanL);
  echoPanL.connect(echoWet);
  echoR.connect(echoToneR);
  echoToneR.connect(echoTapR);
  echoTapR.connect(echoPanR);
  echoPanR.connect(echoWet);
  echoL.connect(echoFb);
  echoR.connect(echoFb);
  echoFb.connect(echoDamp);
  // Two delay returns sum into one feedback node. Average them before feeding
  // both delays: otherwise the loop gain doubles and exceeds 1 at high FX.
  const echoReturn = ctx.createGain();
  echoReturn.gain.value = 0.5;
  echoDamp.connect(echoReturn);
  const echoLifecycle = createIdleEffect(ctx, [
    [gain, echoL], [gain, echoR], [echoReturn, echoL], [echoReturn, echoR], [echoWet, fxOut],
  ]);

  gain.connect(revSend);
  revSend.connect(revPre);
  revPre.connect(revHp);
  revHp.connect(revLp);
  revLp.connect(conv);
  conv.connect(reverbWet);
  reverbWet.connect(fxOut);

  const performance = createAutoPerformance(ctx, impulse);
  fxOut.connect(performance.input);
  performance.output.connect(analyser);

  // Preascultare (PFL): semnalul e luat ÎNAINTE de fader și de crossfader, deci
  // auzi piesa în căști chiar dacă e trasă la zero în boxe. Se aude doar dacă
  // utilizatorul alege o ieșire de căști.
  const monitorSend = ctx.createGain();
  monitorSend.gain.value = 0;
  filter.connect(monitorSend);

  return {
    audio,
    src,
    trim,
    low,
    mid,
    high,
    filter,
    gain,
    dry,
    karDry,
    karWet,
    karR,
    echo: echoL,
    echoL,
    echoR,
    echoFb,
    echoDamp,
    echoWet,
    echoLifecycle,
    conv,
    revSend,
    reverbWet,
    fxOut,
    performance,
    analyser,
    monitorSend,
  };
}