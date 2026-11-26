import { smartExitPosition } from '@/lib/autoDjMixPlan';

// Choose once per track/settings: a moving deadline can strand a prepared deck.
export function resolveMixExit(state, deck, audio, config) {
  const duration = audio?.duration;
  if (!Number.isFinite(duration) || duration <= 0) return Infinity;
  if (deck?.analyzing) return duration;
  const key = [deck?.track?.id, duration, deck?.bpm, deck?.beatOffset,
    config.mixPoints, config.mixBars, config.crossfade, config.performanceMode].join('|');
  if (state.exitPlan?.key !== key) {
    state.exitPlan = { key, at: Math.min(duration, smartExitPosition(deck, audio, config)) };
  }
  return state.exitPlan.at;
}