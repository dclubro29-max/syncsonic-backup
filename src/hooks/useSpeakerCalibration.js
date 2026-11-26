import { useCallback, useEffect, useRef, useState } from 'react';
import { measureOutputDelays } from '@/lib/speakerCalibration';
import { measurePhoneDelays } from '@/lib/phoneCalibration';
import { holdAudioParameter } from '@/lib/autoDjAudio';
import { storeDelay } from '@/lib/deckState';
import { playDeckAudio } from '@/lib/playDeckAudio';
import { pushAudioEvent } from '@/lib/audioDiagnostics';

const round = (value) => Math.round(value * 10) / 10;

/** One calibration transaction shared by the speaker page and Concert Sync. */
export function useSpeakerCalibration({ ctxRef, masterRef, decksRef, outputsRef, desiredSpeakersRef, outputRoutingRef, resume, snapshotOutputs, onPlaybackError }) {
  const lock = useRef(null);
  const [calibrationBusy, setBusy] = useState(false);
  const isCalibrating = useCallback(() => !!lock.current, []);
  const cancelCalibration = useCallback((options = {}) => {
    if (lock.current) lock.current.cancelRestore = !!options.restore;
    lock.current?.abort();
  }, []);
  useEffect(() => () => lock.current?.abort(), []);

  const calibrateOutputs = useCallback(async (options = {}) => {
    if (lock.current) throw new Error('O calibrare este deja în desfășurare.');
    const controller = new AbortController();
    lock.current = controller;
    setBusy(true);
    let master, previous, paused = [];
    try {
      const ctx = await resume();
      await outputRoutingRef.current.pending;
      controller.signal.throwIfAborted();
      const outputs = [...outputsRef.current.values()];
      if (outputs.length < 2) throw new Error('Selectează cel puțin două ieșiri audio distincte pentru aliniere.');
      if (outputs.length !== desiredSpeakersRef.current.length || outputs.some((output) => output.playback.failed)) {
        throw new Error('Nu au pornit toate boxele selectate. Rezolvă eroarea ieșirii audio înainte de calibrare.');
      }
      await Promise.all(outputs.map((output) => output.playback.ready));
      if (outputs.some((output) => output.volume <= 0)) throw new Error('O boxă are volumul la 0%. Ridică volumul fiecărei boxe înainte de calibrare.');
      if (ctx.state !== 'running') throw new Error('Permite redarea audio înainte de calibrare.');
      master = masterRef.current;
      previous = master.gain.value;
      holdAudioParameter(master.gain, ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      paused = decksRef.current.filter((deck) => !deck.audio.paused).map(({ audio }) => ({ audio, src: audio.getAttribute('src') }));
      paused.forEach(({ audio }) => audio.pause());
      const settings = outputs.map((output) => ({ output, volume: output.volume, delay: output.delay }));
      const nodes = outputs.map((output) => ({ deviceId: output.deviceId, input: output.delayNode,
        gain: output.outGain, delay: output.delay, getDelay: () => output.delay / 1000,
        isCurrent: () => outputsRef.current.size === outputs.length && settings.every((saved) =>
          outputsRef.current.get(saved.output.deviceId) === saved.output && !saved.output.playback.failed &&
          saved.output.volume === saved.volume && saved.output.delay === saved.delay) }));
      const measured = await measureOutputDelays({ ...options, ctx, nodes, signal: controller.signal });
      const results = measured.results;
      controller.signal.throwIfAborted();
      if (!nodes.every((node) => node.isCurrent())) throw new Error('Lista boxelor s-a schimbat. Repetă alinierea.');
      // Apply only after every speaker passed all repeated measurements.
      results.forEach((result) => {
        const output = outputsRef.current.get(result.deviceId);
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(result.delay / 1000, ctx.currentTime);
        output.delay = result.delay;
        storeDelay(result.deviceId, result.delay);
      });
      snapshotOutputs();
      pushAudioEvent('calibration', `Compensare aplicată pentru ${results.length} boxe`);
      return results;
    } finally {
      const ctx = ctxRef.current;
      try {
        if (master && ctx?.state !== 'closed') {
          holdAudioParameter(master.gain, ctx.currentTime);
          master.gain.setTargetAtTime(previous, ctx.currentTime, 0.02);
        }
        // An emergency stop cancels calibration and must NEVER restart playback.
        if ((!controller.signal.aborted || controller.cancelRestore) && ctx?.state !== 'closed') {
          const resumed = await Promise.allSettled(paused
            .filter(({ audio, src }) => audio.getAttribute('src') === src && !audio.ended)
            .map(({ audio }) => playDeckAudio(audio, controller.signal.aborted ? undefined : controller.signal)));
          if ((!controller.signal.aborted || controller.cancelRestore) && resumed.some((result) => result.status === 'rejected')) {
            onPlaybackError('Măsurarea s-a încheiat, dar o piesă nu a putut fi reluată. Apasă Play pentru a relua manual.');
          }
        }
      } finally {
        lock.current = null;
        setBusy(false);
      }
    }
  }, [ctxRef, masterRef, decksRef, outputsRef, desiredSpeakersRef, outputRoutingRef, resume, snapshotOutputs, onPlaybackError]);

  /**
   * Aliniere în trei măsurători: starea actuală, diferența fizică fără
   * compensare și verificarea după compensare. Rezultatul se păstrează doar
   * dacă s-a îmbunătățit și măsurătoarea este stabilă; altfel revine la valorile vechi.
   */
  const alignOutputs = useCallback(async ({ microphoneId, zone, onProgress } = {}) => {
    if (lock.current) throw new Error('O calibrare este deja în desfășurare.');
    const controller = new AbortController();
    lock.current = controller;
    setBusy(true);
    let master, previousGain, paused = [], previousDelays = [], applied = false;
    const revert = () => {
      const ctx = ctxRef.current;
      if (!previousDelays.length || !ctx || ctx.state === 'closed') return;
      previousDelays.forEach(({ deviceId, delay }) => {
        const output = outputsRef.current.get(deviceId);
        if (!output) return;
        output.delay = delay;
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(delay / 1000, ctx.currentTime);
      });
      applied = false;
      snapshotOutputs();
    };
    try {
      const ctx = await resume();
      await outputRoutingRef.current.pending;
      controller.signal.throwIfAborted();
      const outputs = [...outputsRef.current.values()];
      if (outputs.length < 2) throw new Error('Alinierea automată are nevoie de cel puțin două ieșiri controlabile separat. Dacă sistemul vede boxele ca o singură ieșire, folosește testul de ascultare.');
      if (outputs.length !== desiredSpeakersRef.current.length || outputs.some((output) => output.playback.failed)) {
        throw new Error('Nu au pornit toate boxele selectate. Rezolvă ieșirea refuzată înainte de aliniere.');
      }
      await Promise.all(outputs.map((output) => output.playback.ready));
      if (outputs.some((output) => output.volume <= 0)) throw new Error('O boxă are volumul la 0%. Ridică volumul fiecărei boxe înainte de aliniere.');
      if (ctx.state !== 'running') throw new Error('Permite redarea audio înainte de aliniere.');
      previousDelays = outputs.map((output) => ({ deviceId: output.deviceId, delay: output.delay }));
      master = masterRef.current;
      previousGain = master.gain.value;
      holdAudioParameter(master.gain, ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      paused = decksRef.current.filter((deck) => !deck.audio.paused).map(({ audio }) => ({ audio, src: audio.getAttribute('src') }));
      paused.forEach(({ audio }) => audio.pause());
      const settings = outputs.map((output) => ({ output, volume: output.volume, delay: output.delay }));
      const nodes = outputs.map((output) => ({ deviceId: output.deviceId, input: output.delayNode,
        gain: output.outGain, delay: output.delay, getDelay: () => output.delay / 1000,
        isCurrent: () => outputsRef.current.size === outputs.length && settings.every((saved) =>
          outputsRef.current.get(saved.output.deviceId) === saved.output && !saved.output.playback.failed) }));
      pushAudioEvent('calibration', 'Aliniere automată pornită');
      // 1. Starea de acum, cu întârzierile existente — termenul de comparație.
      onProgress?.({ phase: 'baseline' });
      const baseline = await measureOutputDelays({ ctx, nodes, microphoneId, signal: controller.signal, preserveDelays: true, maxSpread: Infinity,
        onProgress: (index, total, trial) => onProgress?.({ phase: 'baseline', index, total, trial }) });
      controller.signal.throwIfAborted();
      if (!nodes.every((node) => node.isCurrent())) throw new Error('Lista boxelor s-a schimbat. Repetă alinierea.');
      // 2. Diferența fizică, cu întârzierile aduse la zero: din ea se calculează compensarea.
      onProgress?.({ phase: 'physical' });
      const physical = await measureOutputDelays({ ctx, nodes, microphoneId, signal: controller.signal, preserveDelays: false,
        onProgress: (index, total, trial) => onProgress?.({ phase: 'physical', index, total, trial }) });
      controller.signal.throwIfAborted();
      if (!nodes.every((node) => node.isCurrent())) throw new Error('Lista boxelor s-a schimbat. Repetă alinierea.');
      // 3. Apply provisionally, then verify at the listening point.
      physical.results.forEach((result) => {
        const output = outputsRef.current.get(result.deviceId);
        if (!output) return;
        output.delay = result.delay;
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(result.delay / 1000, ctx.currentTime);
      });
      applied = true;
      onProgress?.({ phase: 'after' });
      const after = await measureOutputDelays({ ctx, nodes, microphoneId, signal: controller.signal, preserveDelays: true,
        onProgress: (index, total, trial) => onProgress?.({ phase: 'after', index, total, trial }) });
      controller.signal.throwIfAborted();
      const reliable = after.uncertainty <= 8;
      // Comparison is against what was audible before, not against the raw physical gap.
      const improved = after.spread < baseline.spread - 1 || after.spread <= 10;
      const verified = reliable && improved && after.spread <= 10;
      if (!improved || !reliable) {
        revert();
        const reason = !reliable
          ? `Măsurătoarea după compensare este prea variabilă (±${round(after.uncertainty)} ms). Am păstrat reglajele anterioare; apropie microfonul de boxe și repetă.`
          : `Diferența nu s-a îmbunătățit (${round(baseline.spread)} ms → ${round(after.spread)} ms). Am păstrat reglajele anterioare.`;
        pushAudioEvent('calibration', `Aliniere respinsă: ${reason}`);
        return { ok: false, applied: false, verified: false, reason, before: baseline, physical, after,
          deviceIds: outputs.map((output) => output.deviceId), zone };
      }
      after.results.forEach((result) => {
        const output = outputsRef.current.get(result.deviceId);
        if (!output) return;
        output.delay = result.delay;
        storeDelay(result.deviceId, result.delay);
      });
      snapshotOutputs();
      pushAudioEvent('calibration', verified
        ? `Aliniere verificată: ${round(baseline.spread)} ms → ${round(after.spread)} ms`
        : `Compensare aplicată, dar peste țintă: ${round(after.spread)} ms`);
      return { ok: true, applied: true, verified, before: baseline, physical, after,
        deviceIds: outputs.map((output) => output.deviceId), zone };
    } catch (error) {
      if (applied) revert();
      throw error;
    } finally {
      const ctx = ctxRef.current;
      try {
        if (master && ctx?.state !== 'closed') {
          holdAudioParameter(master.gain, ctx.currentTime);
          master.gain.setTargetAtTime(previousGain, ctx.currentTime, 0.02);
        }
        if ((!controller.signal.aborted || controller.cancelRestore) && ctx?.state !== 'closed') {
          const resumed = await Promise.allSettled(paused
            .filter(({ audio, src }) => audio.getAttribute('src') === src && !audio.ended)
            .map(({ audio }) => playDeckAudio(audio, controller.signal.aborted ? undefined : controller.signal)));
          if ((!controller.signal.aborted || controller.cancelRestore) && resumed.some((result) => result.status === 'rejected')) {
            onPlaybackError('Alinierea s-a încheiat, dar o piesă nu a putut fi reluată. Apasă Play pentru a relua manual.');
          }
        }
      } finally {
        lock.current = null;
        setBusy(false);
      }
    }
  }, [ctxRef, masterRef, decksRef, outputsRef, desiredSpeakersRef, outputRoutingRef, resume, snapshotOutputs, onPlaybackError]);

  /**
   * Aceeași tranzacție de aliniere, dar microfonul este telefonul: gazda
   * programează semnalele pe ceasul audio, telefonul trimite doar momentele
   * detectate, iar compensarea se aplică numai dacă probele se repetă stabil.
   */
  const alignWithPhone = useCallback(async ({ sessionId, zone, updateSession, onProgress, testLevel = 0.34 } = {}) => {
    if (lock.current) throw new Error('O calibrare este deja în desfășurare.');
    const controller = new AbortController();
    lock.current = controller;
    setBusy(true);
    let master, previousGain, paused = [], previousDelays = [], applied = false;
    const revert = () => {
      const ctx = ctxRef.current;
      if (!previousDelays.length || !ctx || ctx.state === 'closed') return;
      previousDelays.forEach(({ deviceId, delay }) => {
        const output = outputsRef.current.get(deviceId);
        if (!output) return;
        output.delay = delay;
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(delay / 1000, ctx.currentTime);
      });
      applied = false;
      snapshotOutputs();
    };
    try {
      const ctx = await resume();
      await outputRoutingRef.current.pending;
      controller.signal.throwIfAborted();
      const outputs = [...outputsRef.current.values()];
      if (outputs.length < 2) throw new Error('Alinierea cu telefonul are nevoie de cel puțin două ieșiri controlabile separat. Dacă sistemul vede boxele ca o singură ieșire, folosește testul de ascultare.');
      if (outputs.length !== desiredSpeakersRef.current.length || outputs.some((output) => output.playback.failed)) {
        throw new Error('Nu au pornit toate boxele selectate. Rezolvă ieșirea refuzată înainte de aliniere.');
      }
      await Promise.all(outputs.map((output) => output.playback.ready));
      if (outputs.some((output) => output.volume <= 0)) throw new Error('O boxă are volumul la 0%. Ridică volumul fiecărei boxe înainte de aliniere.');
      if (ctx.state !== 'running') throw new Error('Permite redarea audio înainte de aliniere.');
      previousDelays = outputs.map((output) => ({ deviceId: output.deviceId, delay: output.delay }));
      master = masterRef.current;
      previousGain = master.gain.value;
      holdAudioParameter(master.gain, ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      paused = decksRef.current.filter((deck) => !deck.audio.paused).map(({ audio }) => ({ audio, src: audio.getAttribute('src') }));
      paused.forEach(({ audio }) => audio.pause());
      const settings = outputs.map((output) => ({ output, volume: output.volume, delay: output.delay }));
      const nodes = outputs.map((output) => ({ deviceId: output.deviceId, input: output.delayNode,
        gain: output.outGain, delay: output.delay, getDelay: () => output.delay / 1000,
        isCurrent: () => outputsRef.current.size === outputs.length && settings.every((saved) =>
          outputsRef.current.get(saved.output.deviceId) === saved.output && !saved.output.playback.failed) }));
      pushAudioEvent('calibration', 'Aliniere cu telefonul pornită');
      let roundSeq = 0;

      onProgress?.({ phase: 'baseline' });
      const baseline = await measurePhoneDelays({ ctx, nodes, sessionId, updateSession, signal: controller.signal,
        preserveDelays: true, roundStart: roundSeq, testLevel,
        onProgress: (progress) => onProgress?.({ phase: 'baseline', ...progress }) });
      roundSeq = Math.max(roundSeq, (baseline.lastRound ?? roundSeq) + 1);
      controller.signal.throwIfAborted();
      if (!nodes.every((node) => node.isCurrent())) throw new Error('Lista boxelor s-a schimbat. Repetă alinierea.');

      onProgress?.({ phase: 'physical' });
      const physical = await measurePhoneDelays({ ctx, nodes, sessionId, updateSession, signal: controller.signal,
        preserveDelays: false, roundStart: roundSeq, testLevel,
        onProgress: (progress) => onProgress?.({ phase: 'physical', ...progress }) });
      roundSeq = Math.max(roundSeq, (physical.lastRound ?? roundSeq) + 1);
      controller.signal.throwIfAborted();
      if (!nodes.every((node) => node.isCurrent())) throw new Error('Lista boxelor s-a schimbat. Repetă alinierea.');
      if (physical.results.length < 2) {
        const error = new Error('Telefonul nu a detectat destule boxe pentru o compensare sigură. Sesiunea rămâne deschisă; repetă doar boxele lipsă.');
        error.code = 'CALIBRATION_PARTIAL';
        error.details = { phase: 'physical', measured: physical.results, unmeasured: physical.unmeasured, baseline };
        throw error;
      }

      physical.results.forEach((result) => {
        const output = outputsRef.current.get(result.deviceId);
        if (!output) return;
        output.delay = result.delay;
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(result.delay / 1000, ctx.currentTime);
      });
      applied = true;

      onProgress?.({ phase: 'after' });
      const after = await measurePhoneDelays({ ctx, nodes, sessionId, updateSession, signal: controller.signal,
        preserveDelays: true, roundStart: roundSeq, testLevel,
        onProgress: (progress) => onProgress?.({ phase: 'after', ...progress }) });
      controller.signal.throwIfAborted();
      const unmeasured = [...(physical.unmeasured || []), ...(after.unmeasured || [])]
        .filter((item, index, list) => list.findIndex((other) => other.deviceId === item.deviceId) === index);
      const reliable = after.uncertainty <= 8 && unmeasured.length === 0;
      const improved = after.spread < baseline.spread - 1 || after.spread <= 10;
      const verified = reliable && improved && after.spread <= 10;
      if (!improved || !reliable) {
        if (!improved) revert();
        const reason = !reliable
          ? unmeasured.length
            ? `${unmeasured.length} ${unmeasured.length === 1 ? 'boxă nu a fost detectată' : 'boxe nu au fost detectate'} cu încredere. Sesiunea rămâne deschisă; repetă doar boxele lipsă.`
            : `Măsurătoarea telefonului este prea variabilă (±${round(after.uncertainty)} ms). Am păstrat reglajele anterioare; apropie telefonul de boxe și repetă.`
          : `Diferența nu s-a îmbunătățit (${round(baseline.spread)} ms → ${round(after.spread)} ms). Am păstrat reglajele anterioare.`;
        pushAudioEvent('calibration', `Aliniere cu telefonul respinsă: ${reason}`);
        return { ok: false, applied: improved, verified: false, partial: unmeasured.length > 0,
          unmeasured, reason, before: baseline, physical, after,
          deviceIds: outputs.map((output) => output.deviceId), zone };
      }
      after.results.forEach((result) => {
        const output = outputsRef.current.get(result.deviceId);
        if (!output) return;
        output.delay = result.delay;
        storeDelay(result.deviceId, result.delay);
      });
      snapshotOutputs();
      pushAudioEvent('calibration', verified
        ? `Aliniere cu telefonul verificată: ${round(baseline.spread)} ms → ${round(after.spread)} ms`
        : `Compensare cu telefonul aplicată, dar peste țintă: ${round(after.spread)} ms`);
      return { ok: true, applied: true, verified, partial: unmeasured.length > 0, unmeasured,
        before: baseline, physical, after, deviceIds: outputs.map((output) => output.deviceId), zone };
    } catch (error) {
      if (applied) revert();
      throw error;
    } finally {
      const ctx = ctxRef.current;
      try {
        if (master && ctx?.state !== 'closed') {
          holdAudioParameter(master.gain, ctx.currentTime);
          master.gain.setTargetAtTime(previousGain, ctx.currentTime, 0.02);
        }
        if ((!controller.signal.aborted || controller.cancelRestore) && ctx?.state !== 'closed') {
          const resumed = await Promise.allSettled(paused
            .filter(({ audio, src }) => audio.getAttribute('src') === src && !audio.ended)
            .map(({ audio }) => playDeckAudio(audio, controller.signal.aborted ? undefined : controller.signal)));
          if ((!controller.signal.aborted || controller.cancelRestore) && resumed.some((result) => result.status === 'rejected')) {
            onPlaybackError('Alinierea s-a încheiat, dar o piesă nu a putut fi reluată. Apasă Play pentru a relua manual.');
          }
        }
      } finally {
        lock.current = null;
        setBusy(false);
      }
    }
  }, [ctxRef, masterRef, decksRef, outputsRef, desiredSpeakersRef, outputRoutingRef, resume, snapshotOutputs, onPlaybackError]);

  /**
   * Repetă doar boxa care a fost ratată, împreună cu o boxă deja măsurată ca
   * referință. Celelalte reglaje rămân, iar compensarea se recalculează față
   * de cea mai lentă boxă validă.
   */
  const retryPhoneBox = useCallback(async ({
    sessionId, zone, deviceId, priorResults = [], referenceDeviceId, roundStart = 0,
    updateSession, onProgress, testLevel = 0.34,
  } = {}) => {
    if (lock.current) throw new Error('O calibrare este deja în desfășurare.');
    const controller = new AbortController();
    lock.current = controller;
    setBusy(true);
    let master, previousGain, paused = [], applied = false, previousDelays = [];
    const revert = () => {
      const ctx = ctxRef.current;
      if (!previousDelays.length || !ctx || ctx.state === 'closed') return;
      previousDelays.forEach(({ deviceId: id, delay }) => {
        const output = outputsRef.current.get(id);
        if (!output) return;
        output.delay = delay;
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(delay / 1000, ctx.currentTime);
      });
      applied = false;
      snapshotOutputs();
    };
    try {
      const ctx = await resume();
      await outputRoutingRef.current.pending;
      controller.signal.throwIfAborted();
      const outputs = [...outputsRef.current.values()];
      const target = outputs.find((output) => output.deviceId === deviceId);
      const reference = outputs.find((output) => output.deviceId === referenceDeviceId)
        || outputs.find((output) => output.deviceId !== deviceId && priorResults.some((item) => item.deviceId === output.deviceId));
      if (!target || !reference) {
        throw new Error('Boxa de referință nu mai este disponibilă. Repetă măsurătoarea pentru toate boxele.');
      }
      if (outputs.some((output) => output.playback.failed)) {
        throw new Error('O ieșire este refuzată. Rezolvă ieșirea înainte de reîncercare.');
      }
      await Promise.all([target, reference].map((output) => output.playback.ready));
      if (target.volume <= 0 || reference.volume <= 0) {
        throw new Error('Volumul unei boxe este 0%. Ridică volumul înainte de reîncercare.');
      }
      if (ctx.state !== 'running') throw new Error('Permite redarea audio înainte de reîncercare.');
      previousDelays = outputs.map((output) => ({ deviceId: output.deviceId, delay: output.delay }));
      master = masterRef.current;
      previousGain = master.gain.value;
      holdAudioParameter(master.gain, ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      paused = decksRef.current.filter((deck) => !deck.audio.paused).map(({ audio }) => ({ audio, src: audio.getAttribute('src') }));
      paused.forEach(({ audio }) => audio.pause());
      const nodes = [target, reference].map((output) => ({ deviceId: output.deviceId, input: output.delayNode,
        gain: output.outGain, delay: output.delay, getDelay: () => output.delay / 1000,
        isCurrent: () => outputsRef.current.get(output.deviceId) === output && !output.playback.failed }));
      pushAudioEvent('calibration', `Reîncercare doar pentru boxa ${deviceId}`);
      const measured = await measurePhoneDelays({
        ctx, nodes, sessionId, updateSession, signal: controller.signal,
        preserveDelays: false, roundStart, maxRounds: 4, testLevel,
        onProgress: (progress) => onProgress?.({ phase: 'retry', ...progress }),
      });
      controller.signal.throwIfAborted();
      const targetResult = measured.results.find((item) => item.deviceId === deviceId);
      const referenceResult = measured.results.find((item) => item.deviceId === reference.deviceId);
      if (!targetResult || !referenceResult) {
        const error = new Error('Boxa nu a fost detectată nici după reîncercare. Sesiunea rămâne deschisă.');
        error.code = 'CALIBRATION_PARTIAL';
        error.details = { measured: measured.results, unmeasured: measured.unmeasured };
        throw error;
      }
      const referencePrior = priorResults.find((item) => item.deviceId === reference.deviceId);
      const referenceRelative = Number.isFinite(referencePrior?.relative)
        ? referencePrior.relative : referenceResult.relative;
      const targetRelative = referenceRelative + (targetResult.relative - referenceResult.relative);
      const relativeByDevice = new Map(priorResults
        .filter((item) => item.deviceId !== deviceId && Number.isFinite(item.relative))
        .map((item) => [item.deviceId, item.relative]));
      relativeByDevice.set(deviceId, targetRelative);
      const slowest = Math.max(...relativeByDevice.values());
      relativeByDevice.forEach((relative, id) => {
        const output = outputsRef.current.get(id);
        if (!output) return;
        const delay = Math.max(0, Math.round(slowest - relative));
        output.delay = delay;
        output.delayNode.delayTime.cancelScheduledValues(0);
        output.delayNode.delayTime.setValueAtTime(delay / 1000, ctx.currentTime);
        storeDelay(id, delay);
      });
      applied = true;
      snapshotOutputs();
      const results = [...relativeByDevice.entries()].map(([id, relative]) => ({
        deviceId: id,
        relative,
        delay: Math.max(0, Math.round(slowest - relative)),
      }));
      pushAudioEvent('calibration', `Boxa ${deviceId} a fost măsurată din nou`);
      return { ok: true, deviceId, results, unmeasured: measured.unmeasured || [], partial: (measured.unmeasured || []).length > 0, zone };
    } catch (error) {
      if (applied) revert();
      throw error;
    } finally {
      const ctx = ctxRef.current;
      try {
        if (master && ctx?.state !== 'closed') {
          holdAudioParameter(master.gain, ctx.currentTime);
          master.gain.setTargetAtTime(previousGain, ctx.currentTime, 0.02);
        }
        if ((!controller.signal.aborted || controller.cancelRestore) && ctx?.state !== 'closed') {
          const resumed = await Promise.allSettled(paused
            .filter(({ audio, src }) => audio.getAttribute('src') === src && !audio.ended)
            .map(({ audio }) => playDeckAudio(audio, controller.signal.aborted ? undefined : controller.signal)));
          if ((!controller.signal.aborted || controller.cancelRestore) && resumed.some((result) => result.status === 'rejected')) {
            onPlaybackError('Reîncercarea s-a încheiat, dar o piesă nu a putut fi reluată. Apasă Play pentru a relua manual.');
          }
        }
      } finally {
        lock.current = null;
        setBusy(false);
      }
    }
  }, [ctxRef, masterRef, decksRef, outputsRef, outputRoutingRef, resume, snapshotOutputs, onPlaybackError]);

  return { calibrationBusy, calibrateOutputs, alignOutputs, alignWithPhone, retryPhoneBox, isCalibrating, cancelCalibration };
}