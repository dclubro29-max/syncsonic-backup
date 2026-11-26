import { createMasterChain } from "@/lib/masterChain";
import { createSpeakerSafetyDelay } from '@/components/audio/speakerSafety';
import createEmergencyMasterRoute from '@/components/audio/emergencyMasterRoute';
import createStabilityMasterRoute from '@/components/audio/stabilityMasterRoute';

/**
 * Magistrala de sunet: sumă -> masterizare -> limiter -> post -> ieșiri.
 *
 *   master ─┬─ masterChain (EQ, bass mono, lățime, exciter, soft-clip) ─┐
 *           └─ bypassGain ─────────────────────────────────────────────┴─ limiter
 *              -> post -> [ieșire implicită | înregistrare | boxe]
 *
 * Crossfaderul acționează pe deck-urile A și B; C și D intră direct în master.
 */
export function createMasterBus(ctx, { volume = 1, crossfade = 0.5, enhance } = {}) {
  const master = ctx.createGain();
  master.gain.value = 1;

  const limIn = ctx.createGain();
  limIn.gain.value = 1;

  // Limiter de protecție: prinde doar vârfurile care ar clipa.
  // Knee-ul moale și ratio-ul moderat îl fac să sune ca un glue, nu să pompeze
  // dinamica în timpul tranzițiilor.
  const limiter = ctx.createDynamicsCompressor();
  // Prag fix aproape de 0 dBFS, fără knee: prinde doar vârfurile care ar clipa,
  // deci dinamica pieselor rămâne intactă.
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  // Release mai lung: bassul nu mai „respiră” și nu apare pompaj pe kick.
  limiter.release.value = 0.25;

  const limOut = ctx.createGain();
  limOut.gain.value = 1;

  const bypassGain = ctx.createGain();
  bypassGain.gain.value = 0;

  // Final volume fader: mastering, effects and bypass cannot reset its level.
  const post = ctx.createGain();
  post.gain.value = volume;

  // Lanțul de masterizare stă între master și limiter: EQ, bass mono, lățime
  // stereo, claritate și soft-clip. Când e oprit, semnalul trece nealterat.
  // Subsonic: sub 24 Hz nu există muzică, doar deplasare de difuzor și headroom pierdut.
  const subCut = ctx.createBiquadFilter();
  subCut.type = "highpass";
  subCut.frequency.value = 24;
  subCut.Q.value = 0.55;
  master.connect(subCut);

  const masterChain = createMasterChain(ctx);
  masterChain.apply(enhance);
  subCut.connect(masterChain.input);
  masterChain.output.connect(limIn);

  // Semnalul care intră în limiter, pentru diagnosticul „înainte / după”.
  const preLimiterAnalyser = ctx.createAnalyser();
  preLimiterAnalyser.fftSize = 1024;
  preLimiterAnalyser.smoothingTimeConstant = 0.3;
  masterChain.output.connect(preLimiterAnalyser);
  limIn.connect(limiter);
  limiter.connect(limOut);
  limOut.connect(post);

  // Ieșirea limiterului, înainte de volumul master, pentru diagnostic.
  const postLimiterAnalyser = ctx.createAnalyser();
  postLimiterAnalyser.fftSize = 1024;
  postLimiterAnalyser.smoothingTimeConstant = 0.3;
  limOut.connect(postLimiterAnalyser);
  subCut.connect(bypassGain);
  bypassGain.connect(post);

  const masterAnalyser = ctx.createAnalyser();
  masterAnalyser.fftSize = 1024;
  masterAnalyser.smoothingTimeConstant = 0.6;
  post.connect(masterAnalyser);

  // Destinațiile de flux se creează doar când sunt folosite: fiecare flux
  // suplimentar trage tot graficul prin încă o conductă media, iar cu mai multe
  // boxe selectate asta e exact ce face sunetul să se întrerupă.
  let recordDest = null;
  const createRecordDest = () => {
    if (!recordDest) {
      recordDest = ctx.createMediaStreamDestination();
      post.connect(recordDest);
    }
    return recordDest;
  };

  const defaultGain = ctx.createGain();
  defaultGain.gain.value = 1;
  const defaultReserve = createSpeakerSafetyDelay(ctx);
  post.connect(defaultReserve);
  defaultReserve.connect(defaultGain);
  defaultGain.connect(ctx.destination);

  // Magistrala de preascultare: NU trece prin master, deci nu se aude în boxe.
  // Ajunge doar în ieșirea de căști aleasă de utilizator.
  const cueBus = ctx.createGain();
  cueBus.gain.value = 1;
  let cueDest = null;
  const createCueDest = () => {
    if (!cueDest) {
      cueDest = ctx.createMediaStreamDestination();
      cueBus.connect(cueDest);
    }
    return cueDest;
  };

  const xA = ctx.createGain();
  const xB = ctx.createGain();
  xA.gain.value = Math.cos((crossfade * Math.PI) / 2);
  xB.gain.value = Math.cos(((1 - crossfade) * Math.PI) / 2);
  xA.connect(master);
  xB.connect(master);

  const setEmergencyRoute = createEmergencyMasterRoute(ctx, {
    master, subCut, limOut, bypassGain, post, defaultReserve, defaultGain,
  });
  const setStabilityRoute = createStabilityMasterRoute(ctx,
    { master, subCut, limOut, bypassGain, post, masterAnalyser, cueBus }, () => recordDest, () => cueDest);
  return {
    setStabilityRoute,
    setEmergencyRoute,
    master,
    limIn,
    limiter,
    limOut,
    bypassGain,
    post,
    masterChain,
    masterAnalyser,
    preLimiterAnalyser,
    postLimiterAnalyser,
    createRecordDest,
    defaultGain,
    cueBus,
    createCueDest,
    xA,
    xB,
  };
}