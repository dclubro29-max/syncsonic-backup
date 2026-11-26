import { useCallback } from 'react';
import { applyDeckState, deckFilterFrequency } from '@/lib/deckGraph';
import { holdAudioParameter } from '@/lib/autoDjAudio';
import { scheduleAutoPerformance, resetAutoPerformance } from '@/lib/autoPerformanceGraph';
import { scheduleReverbSend } from '@/components/audio/reverbSend';

/** Deck automation extracted from the persistent engine; keeps its public controls. */
export function useDeckAutomation({ ctxRef, decksRef, decksStateRef, xGainsRef, patchDeck, ramp, stabilityRef }) {
  const automateDeckEq = useCallback((i, band, segments) => {
    if (stabilityRef?.current) return;
    const node = decksRef.current[i];
    if (!node || !node[band]) return;
    const p = node[band].gain;
    const list = Array.isArray(segments) ? segments : [{ to: segments, over: 0.05, after: 0 }];
    const final = list[list.length - 1]?.to ?? 0;
    const ctx = ctxRef.current;
    if (!ctx) {
      p.value = final;
      patchDeck(i, (d) => ({ eq: { ...d.eq, [band]: final } }));
      return;
    }
    const t0 = ctx.currentTime;
    holdAudioParameter(p, t0);
    let held = p.value;
    let end = t0;
    list.forEach((s) => {
      const start = Math.max(end, t0 + Math.max(0, s.after || 0));
      const over = Math.max(0.02, s.over ?? 0.05);
      p.setValueAtTime(held, start);
      p.linearRampToValueAtTime(s.to, start + over);
      held = s.to;
      end = start + over;
    });
    patchDeck(i, (d) => ({ eq: { ...d.eq, [band]: final } }));
  }, [ctxRef, decksRef, patchDeck]);

  const automateDeckFx = useCallback((i, kind, segments) => {
    if (stabilityRef?.current) return;
    const node = decksRef.current[i];
    if (!node) return;
    const params = kind === 'echo' ? [node.echoWet.gain, node.echoFb.gain] : [node.reverbWet.gain];
    const toGains = (v) => kind === 'echo' ? [v * 0.85, v > 0 ? 0.15 + v * 0.55 : 0] : [v * 0.9];
    const list = Array.isArray(segments) ? segments : [{ to: segments, over: 0.05, after: 0 }];
    const ctx = ctxRef.current;
    if (!ctx) {
      params.forEach((p, k) => { p.value = toGains(list[list.length - 1]?.to ?? 0)[k] ?? 0; });
      return;
    }
    if (kind === 'reverb') scheduleReverbSend(node.revSend, ctx, list);
    if (kind === 'echo') node.echoLifecycle.schedule(list);
    const t0 = ctx.currentTime;
    const held = params.map((p) => { holdAudioParameter(p, t0); return p.value; });
    let end = t0;
    list.forEach((s) => {
      const start = Math.max(end, t0 + Math.max(0, s.after || 0));
      const over = Math.max(0.02, s.over ?? 0.05);
      const targets = toGains(s.to);
      params.forEach((p, k) => {
        p.setValueAtTime(held[k], start);
        p.linearRampToValueAtTime(targets[k], start + over);
        held[k] = targets[k];
      });
      end = start + over;
    });
  }, [ctxRef, decksRef]);

  // Sweep de filtru programat pe ceasul audio, folosit de stilurile de tranziție.
  const automateDeckFilter = useCallback((i, segments) => {
    if (stabilityRef?.current) return;
    const node = decksRef.current[i];
    const ctx = ctxRef.current;
    if (!node || !ctx) return;
    const list = Array.isArray(segments) ? segments : [{ to: segments, over: 0.05, after: 0 }];
    const values = list.map((s) => s.to);
    const type = values.some((v) => v < -0.02) ? "lowpass"
      : values.some((v) => v > 0.02) ? "highpass" : "allpass";
    const p = node.filter.frequency;
    const now = ctx.currentTime;
    holdAudioParameter(p, now);
    if (node.filter.type !== type) {
      p.setValueAtTime(deckFilterFrequency(0, type), now);
      node.filter.type = type;
    }
    const toFrequency = (v) => deckFilterFrequency(v, type);
    let held = p.value;
    let end = now;
    list.forEach((s) => {
      const start = Math.max(end, ctx.currentTime + Math.max(0, s.after || 0));
      const over = Math.max(0.02, s.over ?? 0.05);
      const target = toFrequency(s.to);
      p.setValueAtTime(held, start);
      p.linearRampToValueAtTime(target, start + over);
      held = target;
      end = start + over;
    });
  }, [ctxRef, decksRef]);

  const resetDeckAutomation = useCallback((i, options = {}) => {
    if (stabilityRef?.current) return;
    const deck = decksStateRef.current[i];
    const node = decksRef.current[i];
    if (!node) return;
    const now = ctxRef.current?.currentTime ?? 0;
    [node.low, node.mid, node.high, node.echoWet, node.echoFb, node.reverbWet].forEach((n) => {
      holdAudioParameter(n.gain, now);
    });
    // Sweep-urile de filtru programate trebuie oprite, altfel ar continua peste reglajul deckului.
    holdAudioParameter(node.filter.frequency, now);
    if (deck) {
      // Do not write a stale tempo and then restore it: both writes can reset
      // the time stretcher. Restore only the requested tone/FX parameters.
      applyDeckState(node, ramp, deck, { keepTempo: !!options.keepTempo });
    }
  }, [ctxRef, decksRef, decksStateRef, ramp]);

  const automateDeckPerformance = useCallback((i, plan) => {
    if (stabilityRef?.current) return;
    scheduleAutoPerformance(decksRef.current[i]?.performance, ctxRef.current, plan);
  }, [ctxRef, decksRef]);
  // Etajul de efecte, expus pentru programarea pulsului de bass beat cu beat.
  const getPerformanceStage = useCallback((i) => stabilityRef?.current ? null : decksRef.current[i]?.performance || null, [decksRef]);
  const resetDeckPerformance = useCallback((i) => {
    if (stabilityRef?.current) return;
    resetAutoPerformance(decksRef.current[i]?.performance, ctxRef.current);
  }, [ctxRef, decksRef]);
  const getDeckPerformance = useCallback((i) => {
    const node = decksRef.current[i], stage = node?.performance;
    if (!stage) return {};
    return { echo: stage.send.gain.value * stage.wet.gain.value, reverb: stage.reverbWet.gain.value,
      roll: stage.roll.wet.gain.value, bass: stage.low.gain.value, level: stage.level.gain.value,
      filterHz: stage.sweep.frequency.value, mixGain: xGainsRef.current[i]?.gain.value ?? 1,
      tempo: node.audio.playbackRate, eqLow: node.low.gain.value, eqMid: node.mid.gain.value };
  }, [decksRef]);
  return { automateDeckEq, automateDeckFx, automateDeckFilter, resetDeckAutomation, automateDeckPerformance, resetDeckPerformance, getDeckPerformance, getPerformanceStage };
}