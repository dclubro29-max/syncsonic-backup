import { performanceStrength, planPerformanceBase, performanceBase } from '@/lib/ultraPerformancePlan';
import { schedulePartyMaxTransition } from '@/lib/partyMaxTransition';

/** Dedicated automatic stage: transition FX do not overwrite the user's manual controls. */
export function scheduleUltraTransition(d, st, cfg, seconds, beat, delay) {
  if (!cfg.performance || d.neutral || d.abBypass) {
    [0, 1].forEach((i) => d.resetDeckPerformance(i));
    return;
  }
  if (cfg.partyMax && cfg.transitionFx && seconds >= 1) {
    schedulePartyMaxTransition(d, st, cfg, seconds, beat, delay);
    return;
  }
  const incoming = st.incomingDeck, outgoing = st.activeDeck;
  const entry = planPerformanceBase(cfg), exit = planPerformanceBase(cfg);
  if (cfg.transitionFx && seconds >= 1) {
    const k = performanceStrength(cfg), base = performanceBase(cfg);
    entry.sweep = [{ to: 0.35 * k, over: 0.04 }, { to: 0, over: seconds * 0.5, after: delay }];
    entry.level = [{ to: base.level * 0.9, over: 0.04 }, { to: base.level, over: seconds * 0.6, after: delay }];
    exit.sweep = [{ to: 0, over: 0.04 }, { to: 0.65 * k, over: seconds * 0.45, after: delay + seconds * 0.5 }];
    exit.level = [{ to: base.level, over: 0.04 }, { to: base.level * 0.82, over: seconds * 0.4, after: delay + seconds * 0.55 }];
    // Ecoul nu depinde de încrederea analizei: dacă BPM-ul nu e sigur, folosim
    // bătaia estimată, ca efectele să se audă la fiecare tranziție ULTRA.
    const tail = Math.max(beat, 0.35);
    exit.beatSeconds = tail;
    exit.echo = [{ to: 0, over: 0.04 }, { to: 0.45 * k, over: Math.min(tail, seconds * 0.1), after: delay + seconds * 0.6 },
      { to: 0, over: seconds * 0.2, after: delay + seconds * 0.8 }];
    exit.reverb = [{ to: 0, over: 0.04 }, { to: 0.2 * k, over: seconds * 0.15, after: delay + seconds * 0.6 },
      { to: 0, over: seconds * 0.2, after: delay + seconds * 0.8 }];
  }
  d.automateDeckPerformance(incoming, entry);
  d.automateDeckPerformance(outgoing, exit);
}