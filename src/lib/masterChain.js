/**
 * Lanțul de masterizare, construit din noduri Web Audio native.
 *
 *   input ─┬─ dry ─────────────────────────────────────────────────────┐
 *          └─ EQ → mid/side (bass mono + lățime stereo) → exciter
 *              → soft-clip → nivel ieșire ─ wet ───────────────────────┴─ output
 *
 * Toate etapele se pot schimba în timp real, cu ramp-uri scurte, fără click-uri.
 * Când lanțul e oprit, semnalul trece nealterat pe calea dry.
 */

const MASTER_KEY = "musicsync.master";

export const MASTER_DEFAULTS = {
  enabled: true,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  // 0 = fără bass mono: scena stereo rămâne neatinsă până când alegi un preset.
  bassMono: 0,
  width: 1,
  exciter: 0,
  drive: 0,
  outGain: 1,
};

// Valorile pe care le aveau instalările vechi. Dacă sunt exact acestea,
// setarea nu a fost atinsă de utilizator, deci o aducem la noul implicit curat.
const LEGACY_UNTUNED = { exciter: 0.25, drive: 0.15 };

export const MASTER_PRESETS = [
  {
    id: "flat",
    label: "Neutru",
    desc: "Fără prelucrare. Punctul de referință.",
    values: { eqLow: 0, eqMid: 0, eqHigh: 0, bassMono: 0, width: 1, exciter: 0, drive: 0, outGain: 1 },
  },
  {
    id: "crystal",
    label: "Crystal Clear",
    desc: "Stereo curat, EQ neutru, fără bass boost sau lărgire. Nivel cu rezervă.",
    values: { eqLow: 0, eqMid: 0, eqHigh: 0, bassMono: 0, width: 1, exciter: 0, drive: 0, outGain: 0.85 },
  },
  {
    id: "clarity",
    label: "Claritate",
    desc: "Înalte deschise și medii curate, fără distorsiune.",
    values: { eqLow: -0.5, eqMid: -1, eqHigh: 1.8, bassMono: 90, width: 1.08, exciter: 0, drive: 0, outGain: 1 },
  },
  {
    id: "warm",
    label: "Cald",
    desc: "Bass plin și înalte domoale, fără oboseală.",
    values: { eqLow: 3, eqMid: 0.5, eqHigh: -1, bassMono: 100, width: 1, exciter: 0.12, drive: 0.15, outGain: 1 },
  },
  {
    id: "punch",
    label: "Punch",
    desc: "Bass strâns, medii în față, nivel ridicat.",
    values: { eqLow: 3.5, eqMid: 1.5, eqHigh: 1.5, bassMono: 140, width: 1.1, exciter: 0.3, drive: 0.25, outGain: 1.05 },
  },
  {
    id: "small",
    label: "Boxă mică",
    desc: "Pentru boxe mici: bass mono, prezență, claritate.",
    values: { eqLow: 4, eqMid: -1.5, eqHigh: 3, bassMono: 180, width: 0.9, exciter: 0.45, drive: 0.2, outGain: 1.05 },
  },
  {
    id: "party",
    label: "Petrecere",
    desc: "Tare și lat, cu protecție la vârfuri.",
    values: { eqLow: 5, eqMid: -1, eqHigh: 2, bassMono: 130, width: 1.4, exciter: 0.4, drive: 0.35, outGain: 1.1 },
  },
  {
    id: "festival",
    label: "Festival",
    desc: "Tare și lat, dar curat: bass mono, prezență și headroom la vârfuri.",
    values: { eqLow: 3, eqMid: -0.5, eqHigh: 1.5, bassMono: 120, width: 1.25, exciter: 0.15, drive: 0.18, outGain: 1.05 },
  },
];

export function readStoredMaster() {
  try {
    const raw = localStorage.getItem(MASTER_KEY);
    if (!raw) return { ...MASTER_DEFAULTS };
    const next = { ...MASTER_DEFAULTS, ...JSON.parse(raw) };
    // Setările neatinse din instalările vechi primeau bass mono la 110 Hz.
    // Un lanț neatins trebuie să fie complet transparent, deci îl aducem la 0.
    const untouched =
      !next.eqLow && !next.eqMid && !next.eqHigh &&
      next.width === 1 && next.outGain === 1 && !next.exciter && !next.drive;
    if (untouched && next.bassMono === 110) next.bassMono = 0;
    if (next.exciter === LEGACY_UNTUNED.exciter && next.drive === LEGACY_UNTUNED.drive) {
      next.exciter = 0;
      next.drive = 0;
    }
    return next;
  } catch (e) {
    return { ...MASTER_DEFAULTS };
  }
}

export function storeMaster(v) {
  try {
    localStorage.setItem(MASTER_KEY, JSON.stringify(v));
  } catch (e) {
    /* ignore */
  }
}

// Saturație moale: la |x| = 1 iese tot 1, dar vârfurile peste 0 dBFS sunt prinse.
// `drive` 0 = identitate exactă, deci lanțul e transparent când e oprit.
const makeSoftCurve = (drive) => {
  const n = 4096;
  const c = new Float32Array(n);
  const k = 1.5;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const shaped = Math.tanh(k * x) / norm;
    c[i] = x + (shaped - x) * drive;
  }
  return c;
};

// Exciter: armonice impare, aplicate doar pe înalte.
const makeExciterCurve = () => {
  const n = 2048;
  const c = new Float32Array(n);
  const k = 2.5;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
};

export function createMasterChain(ctx) {
  const input = ctx.createGain();
  const output = ctx.createGain();

  /* --- tăiere subsonică --- */
  // Sub 24 Hz nu se aude nimic util, dar acele frecvențe consumă headroom și
  // murdăresc bass-ul. Un highpass blând curăță ieșirea fără să atingă muzica.
  const dcBlock = ctx.createBiquadFilter();
  dcBlock.type = "highpass";
  dcBlock.frequency.value = 24;
  dcBlock.Q.value = 0.707;

  /* --- EQ master --- */
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 120;
  const eqMid = ctx.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 1200;
  eqMid.Q.value = 0.8;
  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = "highshelf";
  eqHigh.frequency.value = 6000;

  /* --- mid/side: bass mono + lățime stereo --- */
  const msIn = ctx.createGain();
  // Forțăm stereo, ca o sursă mono să nu ajungă doar pe canalul stâng.
  msIn.channelCount = 2;
  msIn.channelCountMode = "explicit";
  msIn.channelInterpretation = "speakers";

  const splitter = ctx.createChannelSplitter(2);
  const midSum = ctx.createGain();
  const sideSum = ctx.createGain();
  const lToMid = ctx.createGain();
  lToMid.gain.value = 0.5;
  const rToMid = ctx.createGain();
  rToMid.gain.value = 0.5;
  const lToSide = ctx.createGain();
  lToSide.gain.value = 0.5;
  const rToSide = ctx.createGain();
  rToSide.gain.value = -0.5;

  msIn.connect(splitter);
  splitter.connect(lToMid, 0);
  splitter.connect(rToMid, 1);
  splitter.connect(lToSide, 0);
  splitter.connect(rToSide, 1);
  lToMid.connect(midSum);
  rToMid.connect(midSum);
  lToSide.connect(sideSum);
  rToSide.connect(sideSum);

  // Sub frecvența aleasă, componenta laterală dispare → bass-ul devine mono.
  const sideHp = ctx.createBiquadFilter();
  sideHp.type = "highpass";
  sideHp.frequency.value = 120;
  sideHp.Q.value = 0.7;
  sideSum.connect(sideHp);

  const sideWidth = ctx.createGain();
  sideHp.connect(sideWidth);

  const merger = ctx.createChannelMerger(2);
  const midToL = ctx.createGain();
  const midToR = ctx.createGain();
  const sideToL = ctx.createGain();
  const sideToR = ctx.createGain();
  sideToR.gain.value = -1;
  midSum.connect(midToL);
  midSum.connect(midToR);
  sideWidth.connect(sideToL);
  sideWidth.connect(sideToR);
  midToL.connect(merger, 0, 0);
  midToR.connect(merger, 0, 1);
  sideToL.connect(merger, 0, 0);
  sideToR.connect(merger, 0, 1);

  /* --- exciter de claritate --- */
  const excSum = ctx.createGain();
  const excHp = ctx.createBiquadFilter();
  excHp.type = "highpass";
  excHp.frequency.value = 3000;
  excHp.Q.value = 0.7;
  const excShaper = ctx.createWaveShaper();
  excShaper.curve = makeExciterCurve();
  excShaper.oversample = "2x";
  const excGain = ctx.createGain();
  excGain.gain.value = 0;
  merger.connect(excSum);
  merger.connect(excHp);
  excHp.connect(excShaper);
  excShaper.connect(excGain);
  excGain.connect(excSum);

  /* --- soft-clip de protecție --- */
  const clip = ctx.createWaveShaper();
  clip.curve = null;
  clip.oversample = "2x";
  excSum.connect(clip);

  /* --- nivel de ieșire + comutare wet/dry --- */
  const outTrim = ctx.createGain();
  clip.connect(outTrim);
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0;
  outTrim.connect(wet);
  wet.connect(output);
  input.connect(dry);
  dry.connect(output);

  /* --- traseul principal --- */
  input.connect(dcBlock);
  dcBlock.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(msIn);

  let lastDrive = null;
  let lastExciter = null;

  const setParam = (param, value, t = 0.06) => {
    try {
      param.setTargetAtTime(value, ctx.currentTime, Math.max(0.005, t / 3));
    } catch (e) {
      param.value = value;
    }
  };

  const apply = (p) => {
    const s = { ...MASTER_DEFAULTS, ...p };
    setParam(eqLow.gain, s.eqLow);
    setParam(eqMid.gain, s.eqMid);
    setParam(eqHigh.gain, s.eqHigh);
    setParam(sideHp.frequency, Math.max(10, s.bassMono));
    setParam(sideWidth.gain, Math.max(0, s.width));
    // Exciterul e greu (supraeșantionare). Când e oprit, iese complet din traseu,
    // ca să nu consume procesorul de sunet degeaba în timpul setului.
    const exciterOn = s.exciter > 0;
    if (exciterOn !== lastExciter) {
      if (exciterOn) {
        merger.connect(excHp);
        excHp.connect(excShaper);
      } else {
        try {
          merger.disconnect(excHp);
          excHp.disconnect(excShaper);
        } catch (e) {
          /* ignore */
        }
      }
      lastExciter = exciterOn;
    }
    setParam(excGain.gain, Math.max(0, s.exciter) * 0.9);
    setParam(outTrim.gain, Math.max(0.2, Math.min(2, s.outGain)));
    if (lastDrive !== s.drive) {
      const drive = Math.max(0, Math.min(1, s.drive));
      // Even an identity WaveShaper clamps samples above 1 before the limiter.
      // A null curve is a real bypass: preserve clean transition peaks at drive 0.
      clip.curve = drive > 0 ? makeSoftCurve(drive) : null;
      clip.oversample = drive > 0 ? '2x' : 'none';
      lastDrive = s.drive;
    }
    setParam(wet.gain, s.enabled ? 1 : 0);
    setParam(dry.gain, s.enabled ? 0 : 1);
  };

  return { input, output, apply };
}