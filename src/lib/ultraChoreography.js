/**
 * Coregrafia DJ MAX ULTRA: un singur moment muzical pregătit din timp
 * (build → drop), nu efecte întâmplătoare. Fiecare plan revine exact la
 * nivelul de bază al modului, deci sunetul nu se acumulează.
 *
 * `traits` vine din scanarea piesei: dacă momentul are voce, dacă e deschis la
 * înalte, dacă e larg stereo și cât de dinamică e piesa. Din ele se alege ce
 * fel de accent i se potrivește, ca efectul să pară parte din muzică.
 */

import { performanceBase, performanceStrength } from '@/lib/ultraPerformancePlan';

const seg = (to, over, after = 0) => ({ to, over, after });
const clamp01 = (value) => Math.max(0, Math.min(1, value));

const basePlan = (cfg, beat) => {
  const base = performanceBase(cfg);
  return { beatSeconds: beat, base, low: [seg(base.low, 0.04)], level: [seg(base.level, 0.04)] };
};

/**
 * Cât de puternic poate fi accentul: intensitatea aleasă, temperată de cât de
 * dinamică e piesa. O piesă foarte comprimată nu primește efecte mari — s-ar
 * înghesui și ar suna mai slab, nu mai spectaculos.
 */
const accentStrength = (cfg, traits) => {
  const k = performanceStrength(cfg);
  const dynamic = traits?.dynamic;
  const room = dynamic == null ? 1 : Math.max(0.6, Math.min(1.05, 0.55 + dynamic / 14));
  return k * room;
};

// Înaltele: pe o piesă deschisă, puțin; pe una închisă, cât să se simtă.
const airLift = (traits, k) => (traits?.bright ? 0.8 : 2.4) * k;
// Reverb-ul acoperă vocea și înăbușă o piesă deja luminoasă.
const spaceAmount = (traits, k) => (traits?.vocal ? 0.06 : traits?.bright ? 0.1 : 0.18) * k;

/**
 * Build lung, apoi impact de bass exact pe drop. `buildLead` spune cât mai e
 * până la drop din locul unde începe urcușul piesei, ca filtrul, reverbul și
 * înaltele să urce peste muzică, nu peste o fereastră fixă.
 */
export function planDropRitual(cfg, beat, after, confidence = 0.8, buildLead = beat * 4, traits = {}) {
  const k = accentStrength(cfg, traits) * clamp01(confidence);
  const { base } = basePlan(cfg, beat);
  const build = Math.max(0.15, Math.min(buildLead || beat * 4, after - 0.06, beat * 8));
  const start = Math.max(0, after - build);
  const impact = Math.max(0.06, beat * 0.18);
  const hold = beat * 2;
  const echoScale = traits?.vocal ? 0.55 : 1;
  return {
    beatSeconds: beat,
    label: 'Build → drop: filtru, reverb, impact de bass',
    low: [
      seg(base.low, 0.04),
      seg(base.low - 0.4 * k, build * 0.9, start + 0.01),
      seg(base.low + 2.2 * k, impact, after),
      seg(base.low, beat * 3, after + hold),
    ],
    level: [
      seg(base.level, 0.04),
      seg(base.level * 0.96, build * 0.8, start + 0.01),
      seg(base.level * 1.18, impact, after),
      seg(base.level, beat * 3, after + hold),
    ],
    // Înaltele urcă odată cu reverbul, ca urcușul să capete aer, apoi se așază.
    air: [
      seg(0, 0.04),
      seg(airLift(traits, k) * 0.35, build * 0.9, start + 0.02),
      seg(airLift(traits, k), impact, after),
      seg(0, beat * 3, after + beat),
    ],
    sweep: after > beat * 0.8
      ? [seg(0, 0.04), seg(0.14 * k, build * 0.95, start + 0.02),
        seg(0, Math.max(0.12, beat * 0.15), after)]
      : [seg(0, 0.04)],
    reverb: [
      seg(0, 0.04),
      seg(spaceAmount(traits, k) * 0.9, build * 0.9, start + 0.02),
      seg(0, beat * 3, after + beat * 0.5),
    ],
    echo: [
      seg(0, 0.04),
      seg(0.12 * k * echoScale, build * 0.7, start + 0.04),
      seg(0.32 * k * echoScale, impact, after),
      seg(0, beat * 3, after + beat),
    ],
    color: [seg(0, 0.04), seg(0.3 * k, beat * 2, after)],
    // Pe o piesă largă stereo, imaginea se deschide în build și revine în centru pe drop.
    pan: traits?.wide
      ? [seg(0, 0.04), seg(0.18 * k, build * 0.8, start + 0.02), seg(0, beat * 2.5, after)]
      : undefined,
  };
}

/** Accent scurt pe refren/vârf, fără build. */
export function planEventAccent(cfg, beat, after, kind = 'peak', variant = 0, traits = {}) {
  const k = accentStrength(cfg, traits) * (kind === 'chorus' ? 0.9 : 0.7);
  const { base } = basePlan(cfg, beat);
  const lowLift = (kind === 'chorus' ? 1.5 : 1.1) * k;
  const echoScale = traits?.vocal ? 0.4 : 1;
  return {
    beatSeconds: beat,
    label: kind === 'chorus' ? 'Accent de refren' : 'Accent de vârf',
    low: [seg(base.low, 0.04), seg(base.low + lowLift, 0.07, after), seg(base.low, beat * 3, after + beat * 2)],
    level: [seg(base.level, 0.04), seg(base.level * 1.1, 0.07, after), seg(base.level, beat * 2, after + beat)],
    air: [seg(0, 0.04), seg(airLift(traits, k), 0.07, after), seg(0, beat * 3, after + beat * 2)],
    echo: variant % 2
      ? [seg(0, 0.04), seg(0.2 * k * echoScale, 0.06, after), seg(0, beat * 2, after + beat)]
      : [seg(0, 0.04)],
    reverb: [seg(0, 0.04), seg(spaceAmount(traits, k), 0.08, after), seg(0, beat * 3, after + beat)],
    // Un accent stereo scurt, stânga/dreapta alternativ, doar pe piesele largi.
    pan: traits?.wide
      ? [seg(0, 0.04), seg((variant % 2 ? 0.14 : -0.14) * k, 0.06, after), seg(0, beat * 2, after + beat)]
      : undefined,
  };
}

/**
 * Accent pe o parte cu voce: bass și nivel, fără ecou lung peste frază —
 * doar un strop de spațiu și de înalte, ca vocea să rămână limpede.
 */
export function planVocalAccent(cfg, beat, after, traits = {}) {
  const k = accentStrength(cfg, traits) * 0.8;
  const { base } = basePlan(cfg, beat);
  const at = Math.max(0.06, after);
  return {
    beatSeconds: beat,
    label: 'Accent pe voce',
    low: [
      seg(base.low, 0.05),
      seg(base.low + 1.2 * k, 0.08, at),
      seg(base.low, beat * 3, at + beat * 2),
    ],
    level: [
      seg(base.level, 0.05),
      seg(base.level * 1.06, 0.08, at),
      seg(base.level, beat * 2, at + beat * 2),
    ],
    air: [
      seg(0, 0.05),
      seg((traits?.bright ? 0.3 : 0.9) * k, 0.08, at),
      seg(0, beat * 2, at + beat),
    ],
    reverb: [
      seg(0, 0.05),
      seg(spaceAmount(traits, k) * 0.45, 0.1, at),
      seg(0, beat * 2, at + beat),
    ],
  };
}

/** Ridicare discretă pe frază, pentru piesele fără momente detectate. */
export function planPhraseLift(cfg, beat, after, variant = 0, traits = {}) {
  const k = accentStrength(cfg, traits) * 0.55;
  const { base } = basePlan(cfg, beat);
  return {
    beatSeconds: beat,
    label: 'Ridicare pe frază',
    low: [seg(base.low, 0.04), seg(base.low + 0.7 * k, 0.08, after), seg(base.low, beat * 3, after + beat * 2)],
    level: [seg(base.level, 0.04), seg(base.level * 1.05, 0.1, after), seg(base.level, beat * 3, after + beat * 2)],
    air: [seg(0, 0.04), seg(0.7 * k, 0.1, after), seg(0, beat * 3, after + beat * 2)],
    echo: variant % 2 ? [seg(0, 0.04), seg(0.12 * k, 0.08, after), seg(0, beat * 2, after + beat)] : [seg(0, 0.04)],
  };
}