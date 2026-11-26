import { scheduleUltraTransition } from '@/lib/ultraTransitionAudio';
import { scheduleCrossoverEq } from '@/lib/djMaxTransition';

/**
 * Tranziția DJ MAX:
 *  - bass-ul se transferă complementar, fără gol;
 *  - mediile/înaltele ies din calea piesei care intră (doar la MAX/ULTRA);
 *  - stilul „filtru" închide piesa care iese și o deschide pe cea care intră;
 *  - ULTRA adaugă efectele lui de tranziție, dacă sunt pornite.
 */
export function scheduleTransitionAudio(d, st, config, style, seconds, beat, delay = 0) {
  if (d.isStabilityMode?.()) { st.eqScheduled = false; st.filterScheduled = false; return; }
  const incoming = st.incomingDeck, outgoing = st.activeDeck;
  st.eqBaseline = d.decks.map((deck) => ({ ...deck.eq }));
  st.filterBaseline = d.decks.map((deck) => deck.fx?.filter ?? 0);
  st.bassSwap = config.bassSwap && !d.neutral && !d.abBypass;
  st.eqScheduled = false;
  st.filterScheduled = false;
  scheduleUltraTransition(d, st, config, seconds, beat, delay);
  if (st.bassSwap) {
    const middle = seconds / 2;
    const blend = Math.max(0.02, Math.min(beat * 2, seconds * 0.3));
    const entry = st.eqBaseline[incoming], exit = st.eqBaseline[outgoing];
    d.automateDeckEq(incoming, 'low', [
      { to: entry.low - 12, over: 0.02 },
      { to: entry.low, over: blend, after: delay + Math.max(0.02, middle - blend) },
    ]);
    d.automateDeckEq(outgoing, 'low', [
      { to: exit.low - 12, over: blend, after: delay + middle },
    ]);
    st.eqScheduled = true;
  }
  if (scheduleCrossoverEq(d, st, config, seconds, beat, delay)) st.eqScheduled = true;
  if (style === 'filter' && !d.neutral && !d.abBypass) scheduleFilterMix(d, st, config, seconds);
}

/**
 * Mixul cu filtru: piesa care iese se închide cu un trece-jos, cea care intră
 * se deschide dintr-un trece-sus. Ambele revin exact la reglajul lor până la
 * finalul blendului, deci nu rămâne niciun filtru activ după tranziție.
 */
function scheduleFilterMix(d, st, config, seconds) {
  const total = Math.max(1.2, seconds);
  const strength = Math.max(0.35, Math.min(1, Number(config.intensity) || 0.7));
  const incoming = st.incomingDeck, outgoing = st.activeDeck;
  const inc = st.filterBaseline?.[incoming] ?? 0;
  const out = st.filterBaseline?.[outgoing] ?? 0;
  // Tăierea rămâne muzicală: doar câteva dB din fiecare capăt, niciodată o piesă
  // înăbușită complet, și se redeschide mult înainte de finalul blendului.
  d.automateDeckFilter(incoming, [
    { to: inc, over: 0.02 },
    { to: 0.3 * strength, over: 0.12 },
    { to: inc, over: Math.max(0.3, total * 0.55), after: total * 0.15 },
  ]);
  d.automateDeckFilter(outgoing, [
    { to: out, over: 0.02 },
    { to: -0.45 * strength, over: Math.max(0.3, total * 0.5), after: total * 0.12 },
    { to: out, over: 0.18, after: total * 0.82 },
  ]);
  st.filterScheduled = true;
}

export function restoreTransitionEq(d, st) {
  if (st.filterScheduled) {
    // Oprește sweep-urile programate și readuce filtrele la reglajul deckului.
    [0, 1].forEach((index) => d.resetDeckAutomation(index, { keepTempo: true }));
    st.filterScheduled = false;
  }
  if (!st.eqScheduled || !st.eqBaseline) return;
  [0, 1].forEach((index) => {
    const baseline = st.eqBaseline[index];
    if (!baseline) return;
    ['low', 'mid', 'high'].forEach((band) =>
      d.automateDeckEq(index, band, [{ to: baseline[band], over: 0.1 }]));
  });
  st.eqScheduled = false;
}