/**
 * Crossfade-ul DJ MAX: în timp ce bass-ul se transferă complementar, mediile și
 * înaltele ies ușor din calea piesei care intră, iar intrarea capătă prezență.
 * Sunt corecții mici de EQ, programate pe ceasul audio, nu efecte peste muzică.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function scheduleCrossoverEq(d, st, cfg, seconds, beat, delay = 0) {
  if (!cfg.eqCrossover || cfg.performanceMode !== 'max') return false;
  if (!st.eqBaseline || d.neutral || d.abBypass) return false;
  const outgoing = st.activeDeck;
  const incoming = st.incomingDeck;
  const out = st.eqBaseline[outgoing];
  const inc = st.eqBaseline[incoming];
  if (!out || !inc) return false;
  const total = Math.max(1.2, seconds);
  const blend = Math.max(beat * 0.6, total * 0.18);
  const carveAt = Math.max(0, Math.min(total * 0.4, total - blend * 2));
  const restoreAt = Math.max(carveAt + blend, total * 0.85);
  const strength = clamp(Number(cfg.intensity) || 0.7, 0.3, 1);

  // Piesa care iese: mediile se retrag cât cele două cântece se suprapun.
  d.automateDeckEq(outgoing, 'mid', [
    { to: out.mid - 2.6 * strength, over: blend, after: delay + carveAt },
    { to: out.mid, over: blend, after: delay + restoreAt },
  ]);
  d.automateDeckEq(outgoing, 'high', [
    { to: out.high - 1.8 * strength, over: blend, after: delay + carveAt },
    { to: out.high, over: blend, after: delay + restoreAt },
  ]);
  // Piesa care intră: puțină prezență, apoi revine exact la reglajul ei.
  d.automateDeckEq(incoming, 'mid', [
    { to: inc.mid + 1.1 * strength, over: blend, after: delay },
    { to: inc.mid, over: blend, after: delay + total * 0.65 },
  ]);
  d.automateDeckEq(incoming, 'high', [
    { to: inc.high + 1.3 * strength, over: blend, after: delay },
    { to: inc.high, over: blend, after: delay + total * 0.65 },
  ]);
  return true;
}