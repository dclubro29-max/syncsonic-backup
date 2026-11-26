import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { makeImpulse } from "@/lib/audioAnalysis";
import { createAnalyzer } from "@/lib/deckAnalysis";
import { useDeckAutomation } from '@/hooks/useDeckAutomation';
import useDeckPlaybackAccess from '@/hooks/useDeckPlaybackAccess';
import { SYSTEM_DEFAULT_ID, SYSTEM_DEFAULT_OUTPUT } from "@/lib/outputs";
import reconcileSpeakerOutputs from '@/components/audio/reconcileSpeakerOutputs';
import { createMixerContext } from '@/components/audio/mixerOutputClock';
import { captureDeckState, restoreDeckState } from '@/components/audio/deckContextRecovery';
import { useAudioEngineLifetime } from '@/components/audio/useAudioEngineLifetime';
import { routeSpeakerDestination } from '@/components/audio/speakerDestination';
import useAudioStartup from '@/hooks/useAudioStartup';
import useDeckTransport from '@/hooks/useDeckTransport';
import useStabilityAudio from '@/hooks/useStabilityAudio';
import setStabilityDeckRoute from '@/components/audio/stabilityDeckRoute';
import setStabilityOutputRoute from '@/components/audio/stabilityOutputRoute';
import useDeckTransportEvents from '@/components/audio/useDeckTransportEvents';
import useDeckReadout from '@/components/audio/useDeckReadout';
import { scheduleReverbSend } from '@/components/audio/reverbSend';
import { useSpeakerPlaybackWatchdog } from '@/components/audio/useSpeakerPlaybackWatchdog';
import { muteSpeakerPlayback, isSpeakerPlaybackMuted } from '@/components/audio/playbackEmergencyGate';
import setEmergencyDeckRoute from '@/components/audio/emergencyDeckRoute';
import setEmergencyOutputRoute from '@/components/audio/emergencyOutputRoute';
import { setLocalAnalysisPaused } from '@/components/audio/localTrackAnalysis';
import { getBand } from "@/lib/bands";
import { MASTER_PRESETS, readStoredMaster, storeMaster } from "@/lib/masterChain";
import { createMasterBus } from "@/lib/masterBus";
import { useMasterVolume } from '@/hooks/useMasterVolume';
import { useOutputVolume } from '@/hooks/useOutputVolume';
import { useAudioMeters } from '@/components/audio/useAudioMeters';
import { useSpeakerCalibration } from '@/hooks/useSpeakerCalibration';
import { createDeckNode, resetDeckNode, applyDeckFilter, applyDeckState } from "@/lib/deckGraph";
import { applyLoop } from "@/lib/deckLoop";
import { playBeep } from "@/lib/testTone";
import { startBeat } from "@/lib/beatTest";
import { pushAudioEvent } from '@/lib/audioDiagnostics';
import useBeatTest from '@/hooks/useBeatTest';
import useAudioDiagnostics from '@/hooks/useAudioDiagnostics';
import { alignAudioBeats, holdAudioParameter, scheduleCrossfade } from "@/lib/autoDjAudio";
import {
  blankDeck,
  readStoredDelay,
  storeDelay,
  readStoredBand,
  storeBand,
  readStoredCueDevice,
  storeCueDevice,
} from "@/lib/deckState";

export const DECK_COUNT = 4;
export const DECK_LABELS = ["A", "B", "C", "D"];

/**
 * Motor MusicSync — 4 deckuri.
 *
 * Traseu unic, fără dublări:
 *   sursă -> trim -> EQ (bass/mid/high) -> filtru -> volum deck
 *   -> [dry | echo | reverb] -> master -> limiter (cu bypass) -> post
 *   -> ieșire implicită ȘI/SAU câte o întârziere + ieșire proprie per boxă.
 *
 * Crossfaderul acționează pe deckurile A și B; C și D intră direct în master.
 * Loop-urile folosesc loopStart/loopEnd native ale elementului audio, deci sunt
 * precise, nu depind de un cronometru.
 */
export function useDjEngine() {
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const postRef = useRef(null);
  const volumeNodeRef = useRef(null);
  const limInRef = useRef(null);
  const limiterRef = useRef(null);
  const bypassGainRef = useRef(null);
  const defaultGainRef = useRef(null);
  const masterChainRef = useRef(null);
  const masterAnalyserRef = useRef(null);
  const preLimiterAnalyserRef = useRef(null);
  const postLimiterAnalyserRef = useRef(null);
  const neutralSnapLimiterRef = useRef(true);
  const recordDestRef = useRef(null);
  const cueBusRef = useRef(null);
  const cueDestRef = useRef(null);
  const cueAudioRef = useRef(null);

  const xGainsRef = useRef([null, null]);
  const decksRef = useRef([]);
  const outputsRef = useRef(new Map());
  const outputLevelBuffersRef = useRef(new Map());
  const outputRoutingRef = useRef({ version: 0, pending: Promise.resolve() });
  const desiredSpeakersRef = useRef([]);
  const playbackEpochRef = useRef(0);
  const auditionRef = useRef(null);
  const lastRoutingSignatureRef = useRef('');
  const lastOutputErrorRef = useRef(null);
  const analysisCacheRef = useRef(new Map());
  const emergencyRef = useRef(false);
  const stabilityRef = useRef(false);
  const stabilityMasterRef = useRef(null);
  const isStabilityMode = useCallback(() => stabilityRef.current, []);
  const emergencyMasterRef = useRef(null);
  const [emergencyPlayback, setEmergencyPlaybackState] = useState(false);
  const isEmergencyPlayback = useCallback(() => emergencyRef.current, []);

  const { masterVolume, volumeLock, volumeStateRef, setMasterVolume, toggleVolumeLock,
    muteMasterVolume, restoreMasterVolume } = useMasterVolume({ ctxRef, volumeNodeRef });
  const crossRef = useRef(0.5);
  const crossfadeMotionRef = useRef(null);
  const { getDeckMeter, getMasterMeter, getPreLimiterMeter, getPostLimiterMeter, getLimiterReduction, getSpectrum } = useAudioMeters({
    decksRef, masterAnalyserRef, preLimiterAnalyserRef, postLimiterAnalyserRef, limiterRef, stabilityRef,
  });

  const [engineContext, setEngineContext] = useState(null);
  const ready = !!engineContext && engineContext.state !== 'closed';
  const [cueDevice, setCueDeviceState] = useState(readStoredCueDevice);
  const cueDeviceRef = useRef(cueDevice);
  cueDeviceRef.current = cueDevice;
  const [cueVolume, setCueVolumeState] = useState(0.85);
  const cueVolumeRef = useRef(cueVolume);
  cueVolumeRef.current = cueVolume;
  const [outputCount, setOutputCount] = useState(0);
  const [outputError, setOutputError] = useState(null);
  const [playbackError, setPlaybackError] = useState(null);
  const [outputsList, setOutputsList] = useState([]);
  const [crossfade, setCrossfadeState] = useState(0.5);
  const [limiterOn, setLimiterOnState] = useState(true);
  const [neutral, setNeutralState] = useState(false);
  const [abBypass, setAbBypassState] = useState(false);
  const [masterEnhance, setMasterEnhanceState] = useState(readStoredMaster);
  const masterEnhanceRef = useRef(masterEnhance);
  const [decks, setDecks] = useState(() => Array.from({ length: DECK_COUNT }, blankDeck));

  const processingStateRef = useRef({ limiterOn, neutral, abBypass });
  processingStateRef.current = { limiterOn, neutral, abBypass };
  const decksStateRef = useRef(decks);
  useEffect(() => {
    decksStateRef.current = decks;
  }, [decks]);

  const patchDeck = useCallback((i, patch) => {
    setDecks((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], ...(typeof patch === "function" ? patch(n[i]) : patch) };
      return n;
    });
  }, []);

  const ramp = useCallback((param, value, t = 0.03) => {
    const ctx = ctxRef.current;
    if (!param) return;
    if (!ctx) {
      param.value = value;
      return;
    }
    try {
      param.setTargetAtTime(value, ctx.currentTime, Math.max(0.002, t / 3));
    } catch (e) {
      param.value = value;
    }
  }, []);

  /* ------------------------- Preascultare (căști) ------------------------- */

  /**
   * Trimite magistrala de preascultare către o singură ieșire — căștile.
   * Fără o ieșire aleasă, elementul rămâne oprit, deci preascultarea e mută
   * (nu se dublează peste boxe).
   */
  const applyCueDevice = useCallback((deviceId) => {
    const createDest = cueDestRef.current;
    if (!createDest) return;
    let el = cueAudioRef.current;
    if (!deviceId) {
      try {
        el?.pause();
      } catch (e) {
        /* ignore */
      }
      return;
    }
    const dest = createDest();
    if (!el) {
      el = new Audio();
      el.srcObject = dest.stream;
      el.autoplay = true;
      cueAudioRef.current = el;
    }
    if (typeof el.setSinkId === "function") {
      el.setSinkId(deviceId === SYSTEM_DEFAULT_ID ? "" : deviceId).catch(() => {});
    }
    el.play().catch(() => {});
  }, []);

  const setCueDevice = useCallback(
    (deviceId) => {
      setCueDeviceState(deviceId);
      storeCueDevice(deviceId);
      applyCueDevice(deviceId);
    },
    [applyCueDevice]
  );

  const setCueVolume = useCallback(
    (v) => {
      setCueVolumeState(v);
      ramp(cueBusRef.current?.gain, v, 0.03);
    },
    [ramp]
  );

  const toggleMonitor = useCallback(
    (i) => {
      const node = decksRef.current[i];
      const on = !decksStateRef.current[i]?.monitor;
      if (node) ramp(node.monitorSend.gain, on ? 1 : 0, 0.03);
      patchDeck(i, { monitor: on });
    },
    [ramp, patchDeck]
  );

  const setKeyLock = useCallback(
    (i, on) => {
      const node = decksRef.current[i];
      if (stabilityRef.current) {
        if (node) node.audio.preservesPitch = false;
        return;
      }
      if (node && node.audio.preservesPitch !== on) node.audio.preservesPitch = on;
      patchDeck(i, { keyLock: on });
    },
    [patchDeck]
  );

  const snapshotOutputs = useCallback(() => {    setOutputsList(
      Array.from(outputsRef.current.values()).map((o) => ({
        deviceId: o.deviceId,
        delay: o.emergencyBypass ? 0 : o.delay,
        band: o.emergencyBypass || o.stabilityBypass ? 'full' : o.band,
        volume: o.volume,
        state: o.playback.failed ? 'failed' : o.playback.started ? 'active' : 'starting',
        error: o.playback.stats?.error || null,
        route: o.route || 'normal',
        retries: o.retryFailures || 0,
        retryAt: Number.isFinite(o.retryAt) ? o.retryAt : null,
        available: o.available !== false,
        disconnected: !!o.disconnected,
        startedAt: o.playback.startedAt || 0,
        direct: !!o.playback.direct,
      }))
    );
  }, []);

  /** Nivelul din aplicație al unei ramuri: intrare (după filtre) sau ieșire (după volum). */
  const getOutputLevel = useCallback((deviceId, tap = 'output') => {
    const output = outputsRef.current.get(deviceId);
    const analyser = tap === 'branch' ? output?.branchAnalyser : output?.analyser;
    if (!analyser) return { rms: 0, peak: 0 };
    const key = `${deviceId}:${tap}`;
    let buffer = outputLevelBuffersRef.current.get(key);
    if (!buffer || buffer.length !== analyser.fftSize) {
      buffer = new Uint8Array(analyser.fftSize);
      outputLevelBuffersRef.current.set(key, buffer);
    }
    analyser.getByteTimeDomainData(buffer);
    let sum = 0, peak = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const value = (buffer[i] - 128) / 128;
      sum += value * value;
      const absolute = value < 0 ? -value : value;
      if (absolute > peak) peak = absolute;
    }
    return { rms: Math.sqrt(sum / buffer.length), peak };
  }, []);

  /** Diagnosticul unei ieșiri: ruta reală, starea, volumul și nivelul măsurabil. */
  const getOutputDiagnostics = useCallback((deviceId) => {
    const output = outputsRef.current.get(deviceId);
    if (!output) return null;
    return {
      deviceId,
      route: output.route || 'normal',
      state: output.playback?.failed ? 'failed' : output.playback?.started ? 'active' : 'starting',
      volume: output.volume,
      muted: output.volume <= 0.001,
      delay: output.delay,
      started: !!output.playback?.started,
      failed: !!output.playback?.failed,
      error: output.playback?.stats?.error || null,
      branch: getOutputLevel(deviceId, 'branch'),
      output: getOutputLevel(deviceId, 'output'),
    };
  }, [getOutputLevel]);

  const { outputVolumes, outputVolumeRef, setOutputVolume } = useOutputVolume({
    ctxRef, outputsRef, defaultGainRef, snapshotOutputs,
  });

  /* ------------------------- Ieșiri audio ------------------------- */

  const applyOutputs = useCallback(() => {
    const routing = outputRoutingRef.current;
    const version = ++routing.version;
    routing.pending = routing.pending.then(async () => {
      const ctx = ctxRef.current, post = postRef.current;
      const isCurrent = () => version === routing.version && ctx === ctxRef.current && ctx.state !== 'closed';
      if (!ctx || !post || ctx.state !== 'running' || !isCurrent()) return;
      const desired = desiredSpeakersRef.current, existing = outputsRef.current;
      const signature = desired.map(({ deviceId }) => deviceId).sort().join('|');
      if (signature !== lastRoutingSignatureRef.current) {
        lastRoutingSignatureRef.current = signature;
        pushAudioEvent('output', desired.length
          ? `${desired.length} ${desired.length === 1 ? 'ieșire selectată' : 'ieșiri selectate'}`
          : 'Ieșirea sistemului');
      }
      // Only fade the system path out when separate outputs take over. Muting it
      // on every routing pass made the default output drop out briefly even when
      // nothing about the selected speakers had changed.
      if (desired.length && (defaultGainRef.current?.gain.value ?? 0) > 0.001) {
        ramp(defaultGainRef.current?.gain, 0, 0.03);
      }
      const route = await routeSpeakerDestination(ctx, desired, existing, { emergency: emergencyRef.current });
      if (!isCurrent()) return;
      const result = await reconcileSpeakerOutputs({
        context: ctx, post, speakers: desired, outputs: existing, directDeviceId: route.deviceId, isCurrent,
        settings: (deviceId) => ({
          delay: auditionRef.current?.deviceId === deviceId ? 0 : readStoredDelay(deviceId),
          band: readStoredBand(deviceId), volume: outputVolumeRef.current[deviceId] ?? 1,
        }),
        configure: (output) => {
          setEmergencyOutputRoute(post, output, emergencyRef.current);
          setStabilityOutputRoute(post, output, stabilityRef.current);
          if (auditionRef.current?.deviceId === output.deviceId) {
            output.delay = 0;
            output.delayNode.delayTime.value = 0;
          }
        },
        onChange: () => {
          setOutputCount([...existing.values()].filter(({ playback }) => playback.started && !playback.failed).length);
          snapshotOutputs();
        },
      });
      if (!result || !isCurrent()) return;
      ramp(defaultGainRef.current?.gain, desired.length || isSpeakerPlaybackMuted(ctx) ? 0 : (outputVolumeRef.current[SYSTEM_DEFAULT_ID] ?? 1), 0.03);
      const error = result.error || route.error?.message;
      if (error && error !== lastOutputErrorRef.current) {
        lastOutputErrorRef.current = error;
        pushAudioEvent('output-failed', error);
      } else if (!error) lastOutputErrorRef.current = null;
      setOutputError(error ? `${error}${result.count ? ' Celelalte ieșiri continuă.' : ' Verifică boxele selectate; nu am schimbat automat ieșirea.'}` : null);
      setOutputCount(result.count);
      snapshotOutputs();
    }).catch((error) => {
      if (version !== routing.version) return;
      setOutputError(error.name === 'NotAllowedError'
        ? 'Browserul a blocat ieșirea audio. Permite redarea și reselectează boxa.'
        : error.message || 'Boxa nu a putut porni. Reselectează ieșirea audio.');
    });
    return routing.pending;
  }, [ramp, snapshotOutputs]);

  /** Reîncercare manuală doar pentru boxa aleasă, fără să atingă celelalte ramuri. */
  const retryOutput = useCallback((deviceId) => {
    const output = outputsRef.current.get(deviceId);
    if (output) {
      output.retryFailures = 0;
      output.retryAt = 0;
      if (output.playback?.stats) output.playback.stats.error = null;
    }
    return applyOutputs();
  }, [applyOutputs]);

  /** Revenire explicită pe ieșirea sistemului, cu buget de reîncercare proaspăt. */
  const forceSystemOutput = useCallback(() => {
    const output = outputsRef.current.get(SYSTEM_DEFAULT_ID);
    if (output) {
      output.retryFailures = 0;
      output.retryAt = 0;
      if (output.playback?.stats) output.playback.stats.error = null;
    }
    desiredSpeakersRef.current = [{ ...SYSTEM_DEFAULT_OUTPUT, available: true, disconnected: false }];
    return applyOutputs();
  }, [applyOutputs]);

  const ensureContext = useCallback(() => {
    if (ctxRef.current && ctxRef.current.state !== 'closed') return ctxRef.current;
    // A closed context cannot resume. Retire its sources and endpoints, then
    // rebuild from the current tracks and controls rather than reusing dead nodes.
    const recovered = decksRef.current.length ? captureDeckState(decksRef.current, decksStateRef.current) : [];
    outputRoutingRef.current.version += 1;
    outputRoutingRef.current.pending = Promise.resolve();
    outputsRef.current.forEach(({ playback }) => playback.close());
    outputsRef.current.clear();
    if (cueAudioRef.current) {
      cueAudioRef.current.pause();
      cueAudioRef.current.srcObject = null;
      cueAudioRef.current = null;
    }
    const unprocessed = processingStateRef.current.neutral || processingStateRef.current.abBypass;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    // Build once; output routing pins the native destination to the primary box.
    const ctx = createMixerContext(Ctx);

    const {
      master,
      limIn,
      limiter,
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
      setEmergencyRoute,
      setStabilityRoute,
    } = createMasterBus(ctx, {
      volume: volumeStateRef.current.level,
      crossfade: crossRef.current,
      enhance: { ...masterEnhanceRef.current, enabled: !unprocessed && masterEnhanceRef.current.enabled },
    });
    limIn.gain.value = !unprocessed && processingStateRef.current.limiterOn ? 1 : 0;
    bypassGain.gain.value = limIn.gain.value ? 0 : 1;
    defaultGain.gain.value = desiredSpeakersRef.current.length ? 0 : (outputVolumeRef.current[SYSTEM_DEFAULT_ID] ?? 1);
    recordDestRef.current = createRecordDest;
    cueBusRef.current = cueBus;
    cueDestRef.current = createCueDest;
    cueBus.gain.value = cueVolumeRef.current;

    const impulse = makeImpulse(ctx);
    decksRef.current = Array.from({ length: DECK_COUNT }, () => createDeckNode(ctx, impulse));
    decksRef.current[0].analyser.connect(xA);
    decksRef.current[1].analyser.connect(xB);
    decksRef.current[2].analyser.connect(master);
    decksRef.current[3].analyser.connect(master);
    decksRef.current.forEach((n) => n.monitorSend.connect(cueBus));
    applyCueDevice(emergencyRef.current || stabilityRef.current ? null : cueDeviceRef.current);
    stabilityMasterRef.current = setStabilityRoute;
    setStabilityRoute(stabilityRef.current);
    emergencyMasterRef.current = setEmergencyRoute;
    setEmergencyRoute(emergencyRef.current);
    if (emergencyRef.current) decksRef.current.forEach((node) => setEmergencyDeckRoute(node, true));

    ctxRef.current = ctx;
    masterRef.current = master;
    postRef.current = post;
    volumeNodeRef.current = post;
    limInRef.current = limIn;
    limiterRef.current = limiter;
    bypassGainRef.current = bypassGain;
    defaultGainRef.current = defaultGain;
    masterChainRef.current = masterChain;
    masterAnalyserRef.current = masterAnalyser;
    preLimiterAnalyserRef.current = preLimiterAnalyser;
    postLimiterAnalyserRef.current = postLimiterAnalyser;
    xGainsRef.current = [xA, xB];

    if (recovered.length) {
      recovered.forEach((state, index) => restoreDeckState(decksRef.current[index], state, ramp, unprocessed));
      decksStateRef.current = recovered;
      setDecks(recovered);
      setOutputCount(0);
      setOutputError(null);
      snapshotOutputs();
    }
    if (stabilityRef.current) decksRef.current.forEach((node, i) =>
      setStabilityDeckRoute(node, i === 0 ? xA : i === 1 ? xB : master, cueBus, true));
    setEngineContext(ctx);
    return ctx;
  }, [applyCueDevice, ramp, snapshotOutputs]);

  const resume = useAudioStartup({ ensureContext, outputsRef, desiredSpeakersRef,
    defaultGainRef, outputVolumeRef, applyOutputs, restoreMasterVolume, setPlaybackError,
    epochRef: playbackEpochRef });

  /**
   * Mod film: sunetul unui element video intră direct în magistrala master,
   * deci primește masterizarea, limiterul și toate ieșirile selectate —
   * cu întârzierea și banda fiecărei boxe. Elementul nu mai cântă singur.
   */
  const movieRef = useRef({ element: null, source: null });

  const attachMovieElement = useCallback(
    async (element) => {
      if (!element) return null;
      const ctx = await resume();
      if (movieRef.current.element === element) return movieRef.current.source;
      if (movieRef.current.source) {
        try {
          movieRef.current.source.disconnect();
        } catch (e) {
          /* ignore */
        }
        movieRef.current = { element: null, source: null };
      }
      const source = ctx.createMediaElementSource(element);
      source.connect(masterRef.current);
      movieRef.current = { element, source };
      return source;
    },
    [resume]
  );

  const detachMovie = useCallback(() => {
    const current = movieRef.current;
    if (current.source) {
      try {
        current.source.disconnect();
      } catch (e) {
        /* ignore */
      }
    }
    movieRef.current = { element: null, source: null };
  }, []);

  const { calibrationBusy, calibrateOutputs, alignOutputs, alignWithPhone, retryPhoneBox, isCalibrating, cancelCalibration } = useSpeakerCalibration({
    ctxRef, masterRef, decksRef, outputsRef, desiredSpeakersRef, outputRoutingRef, resume, snapshotOutputs,
    onPlaybackError: setOutputError,
  });

  /* ------------------------- Analiză ------------------------- */

  const { analyze } = useMemo(() => createAnalyzer({
    cache: analysisCacheRef, decksRef, decksStateRef, patchDeck, ramp,
  }), [patchDeck, ramp]);

  const { stabilityMode, setStabilityMode } = useStabilityAudio({
    stabilityRef, stabilityMasterRef, emergencyRef, isCalibrating, decksRef, outputsRef,
    xGainsRef, masterRef, postRef, cueBusRef, cueDeviceRef, applyCueDevice,
    decksStateRef, processingStateRef, ramp, setDecks, analyze, snapshotOutputs,
  });
  useDeckTransportEvents(decksRef, engineContext, stabilityMode, patchDeck);

  /* ------------------------- Deck-uri ------------------------- */

  useDeckReadout({ decksRef, ctxRef, crossfadeMotionRef, xGainsRef, crossRef,
    setCrossfadeState, setDecks, stabilityMode });

  const { togglePlay, cancelDeckStart, cancelDeckStarts } = useDeckTransport({
    decksRef, resume, patchDeck, isCalibrating, ensureContext,
  });

  const loadTrack = useCallback(
    async (i, track, { waitForAnalysis = false } = {}) => {
      if (isCalibrating()) return;
      // Loading is allowed before audio permission; only Play unlocks output.
      ensureContext();
      const node = decksRef.current[i];
      if (!node) return;
      cancelDeckStart(i);
      node.audio.pause();
      node.audio.loop = false;
      node.audio.loopStart = 0;
      node.audio.loopEnd = 0;
      node.audio.src = track.url;
      // Piesa nouă nu rămâne în preascultare și pornește cu key lock.
      node.audio.preservesPitch = !stabilityRef.current;
      ramp(node.monitorSend.gain, 0);
      if (stabilityRef.current) {
        holdAudioParameter(node.gain.gain, ctxRef.current.currentTime);
        ramp(node.gain.gain, 0.8);
        node.audio.playbackRate = 1;
      } else resetDeckNode(node, ramp);
      node.audio.load();
      setDecks((prev) => {
        const n = [...prev];
        n[i] = { ...blankDeck(), track };
        return n;
      });
      if (!emergencyRef.current && !stabilityRef.current) {
        const analysis = analyze(i, track);
        if (waitForAnalysis) await analysis;
      }
    },
    [ensureContext, ramp, analyze, isCalibrating, cancelDeckStart]
  );

  const seek = useCallback(
    (i, t) => {
      const node = decksRef.current[i];
      if (!node) return;
      try {
        node.audio.currentTime = Math.max(0, t);
      } catch (e) {
        /* ignore */
      }
      patchDeck(i, { progress: t });
    },
    [patchDeck]
  );

  const setTempo = useCallback(
    (i, r) => {
      const node = decksRef.current[i];
      const rate = emergencyRef.current ? 1 : stabilityRef.current
        ? (node && !node.audio.paused ? node.audio.playbackRate : 1) : r;
      if (node && Math.abs(node.audio.playbackRate - rate) > 0.000001) node.audio.playbackRate = rate;
      patchDeck(i, { tempo: rate });
    },
    [patchDeck]
  );

  const setEq = useCallback(
    (i, band, db) => {
      if (stabilityRef.current) return;
      const node = decksRef.current[i];
      if (node && node[band]) ramp(node[band].gain, db);
      setNeutralState(false);
      patchDeck(i, (d) => ({ eq: { ...d.eq, [band]: db } }));
    },
    [ramp, patchDeck]
  );

  const setDeckVolume = useCallback(
    (i, v) => {
      const node = decksRef.current[i];
      if (node) {
        ramp(node.gain.gain, v);
        if (node.emergencyGain) ramp(node.emergencyGain.gain, Math.max(0, Math.min(1, v)));
      }
      patchDeck(i, { volume: v });
    },
    [ramp, patchDeck]
  );

  const setDeckTrim = useCallback(
    (i, v) => {
      const node = decksRef.current[i];
      // Trim-ul manual se aplică peste nivelarea automată a piesei.
      const auto = decksStateRef.current[i]?.autoTrim ?? 1;
      if (node) ramp(node.trim.gain, v * auto);
      patchDeck(i, { trim: v });
    },
    [ramp, patchDeck]
  );

  /* ------------------------- Efecte ------------------------- */

  const setFx = useCallback(
    (i, kind, v) => {
      if (stabilityRef.current) return;
      const node = decksRef.current[i];
      if (node) {
        if (kind === "echo") {
          node.echoLifecycle.schedule([{ to: v, over: 0.03 }]);
          ramp(node.echoWet.gain, v * 0.85);
          ramp(node.echoFb.gain, v > 0 ? 0.15 + v * 0.55 : 0);
        } else if (kind === "reverb") {
          scheduleReverbSend(node.revSend, ctxRef.current, [{ to: v, over: 0.03 }]);
          ramp(node.reverbWet.gain, v * 0.9);
        } else if (kind === "filter") {
          applyDeckFilter(node, ramp, v);
        } else if (kind === "karaoke") {
          ramp(node.karDry.gain, 1 - v);
          ramp(node.karWet.gain, v);
          ramp(node.karR.gain, -v);
        }
      }
      patchDeck(i, (d) => ({ fx: { ...d.fx, [kind]: v } }));
    },
    [ramp, patchDeck]
  );

  const resetFx = useCallback(
    (i) => {
      const node = decksRef.current[i];
      if (node) {
        node.echoLifecycle.schedule([{ to: 0, over: 0.03 }]);
        ramp(node.echoWet.gain, 0);
        ramp(node.echoFb.gain, 0);
        ramp(node.reverbWet.gain, 0);
        scheduleReverbSend(node.revSend, ctxRef.current, [{ to: 0, over: 0.03 }]);
        if (node.filter.type !== "allpass") node.filter.type = "allpass";
        ramp(node.filter.frequency, 20000, 0.05);
        ramp(node.karDry.gain, 1);
        ramp(node.karWet.gain, 0);
        ramp(node.karR.gain, 0);
      }
      patchDeck(i, { fx: { echo: 0, reverb: 0, filter: 0, karaoke: 0 } });
    },
    [ramp, patchDeck]
  );

  /* ------------------------- CUE / Hot cues ------------------------- */

  const setCue = useCallback(
    (i, t) => {
      patchDeck(i, { cue: t });
    },
    [patchDeck]
  );

  const cueAction = useCallback(
    (i) => {
      const node = decksRef.current[i];
      const d = decksStateRef.current[i];
      if (!node || !d || !d.track) return;
      if (!node.audio.paused) {
        if (d.cue != null) {
          try {
            node.audio.currentTime = d.cue;
          } catch (e) {
            /* ignore */
          }
          patchDeck(i, { progress: d.cue });
        } else {
          patchDeck(i, { cue: node.audio.currentTime });
        }
      } else {
        patchDeck(i, { cue: node.audio.currentTime });
      }
    },
    [patchDeck]
  );

  const setHotCue = useCallback(
    (i, slot) => {
      const node = decksRef.current[i];
      if (!node) return;
      const t = node.audio.currentTime || 0;
      patchDeck(i, (d) => {
        const hc = [...d.hotCues];
        hc[slot] = t;
        return { hotCues: hc };
      });
    },
    [patchDeck]
  );

  const jumpHotCue = useCallback(
    (i, slot) => {
      const node = decksRef.current[i];
      const d = decksStateRef.current[i];
      const t = d?.hotCues?.[slot];
      if (!node || t == null) return;
      try {
        node.audio.currentTime = t;
      } catch (e) {
        /* ignore */
      }
      patchDeck(i, { progress: t });
    },
    [patchDeck]
  );

  const clearHotCue = useCallback(
    (i, slot) => {
      patchDeck(i, (d) => {
        const hc = [...d.hotCues];
        hc[slot] = null;
        return { hotCues: hc };
      });
    },
    [patchDeck]
  );

  /* ------------------------- Loop-uri ------------------------- */

  const setRepeat = useCallback(
    (i, on) => {
      const node = decksRef.current[i];
      if (!node) return;
      const duration = node.audio.duration && isFinite(node.audio.duration) ? node.audio.duration : 0;
      applyLoop(node, null, on, duration);
      patchDeck(i, { repeat: on, loop: null });
    },
    [applyLoop, patchDeck]
  );

  const setLoopBoundary = useCallback(
    (i, which) => {
      const node = decksRef.current[i];
      const d = decksStateRef.current[i];
      if (!node || !d) return;
      const t = node.audio.currentTime || 0;
      const current = d.loop || { start: 0, end: 0 };
      let next;
      if (which === "in") {
        next = { start: t, end: current.end > t ? current.end : t + 4 };
      } else {
        next = { start: current.start < t ? current.start : Math.max(0, t - 4), end: t };
      }
      if (next.end <= next.start) next.end = next.start + 0.5;
      applyLoop(node, next, false, node.audio.duration || 0);
      patchDeck(i, { loop: next, repeat: false });
    },
    [applyLoop, patchDeck]
  );

  const beatLoop = useCallback(
    (i, beats) => {
      const node = decksRef.current[i];
      const d = decksStateRef.current[i];
      if (!node || !d || !d.bpm) return;
      const beat = 60 / (d.bpm * d.tempo);
      const start = node.audio.currentTime || 0;
      const next = { start, end: start + beat * beats, beats };
      applyLoop(node, next, false, node.audio.duration || 0);
      patchDeck(i, { loop: next, repeat: false });
    },
    [applyLoop, patchDeck]
  );

  const clearLoop = useCallback(
    (i) => {
      const node = decksRef.current[i];
      if (node) applyLoop(node, null, false, 0);
      patchDeck(i, { loop: null, repeat: false });
    },
    [applyLoop, patchDeck]
  );

  /* ------------------------- BPM & SYNC ------------------------- */

  const setDeckBpm = useCallback(
    (i, bpm, manual = true) => {
      if (!isFinite(bpm) || bpm <= 0) return;
      const value = Math.round(bpm * 10) / 10;
      patchDeck(i, { bpm: value, bpmManual: manual });
    },
    [patchDeck]
  );

  // Faza grid-ului de ritm (offset în secunde). Se normalizează la desenare.
  const setDeckBeatOffset = useCallback(
    (i, seconds) => {
      if (!isFinite(seconds)) return;
      patchDeck(i, { beatOffset: seconds });
    },
    [patchDeck]
  );

  const resetBeatOffset = useCallback(
    (i) => {
      patchDeck(i, (d) => ({ beatOffset: d.beatOffsetDetected || 0 }));
    },
    [patchDeck]
  );

  const syncDeck = useCallback(
    (i, refIndex) => {
      if (emergencyRef.current || stabilityRef.current) return false;
      const a = decksRef.current[i];
      const b = decksRef.current[refIndex];
      const da = decksStateRef.current[i];
      const db = decksStateRef.current[refIndex];
      if (!a || !b || !da?.track || !db?.track || !da.bpm || !db.bpm) return false;

      const targetTempo = (db.bpm * db.tempo) / da.bpm;
      const clamped = Math.max(0.5, Math.min(2, targetTempo));
      if (Math.abs(a.audio.playbackRate - clamped) > 0.000001) a.audio.playbackRate = clamped;
      patchDeck(i, { tempo: clamped });

      const beatA = 60 / (da.bpm * clamped);
      const beatB = 60 / (db.bpm * db.tempo);
      const pa = (a.audio.currentTime / beatA) % 1;
      const pb = (b.audio.currentTime / beatB) % 1;
      let diff = (pb - pa) * beatA;
      if (diff < 0) diff += beatA;
      try {
        a.audio.currentTime = Math.max(0, a.audio.currentTime + diff);
      } catch (e) {
        /* ignore */
      }
      return true;
    },
    [patchDeck]
  );

  /**
   * Aliniere pe beat, respectând beatgrid-ul detectat al fiecărei piese.
   * Potrivește tempo-ul, apoi mută deck-ul `i` cu cel mult jumătate de beat,
   * ca primul lui beat să cadă exact peste beat-ul deck-ului de referință.
   */
  const beatAlign = useCallback(
    (i, refIndex, options) => {
      if (emergencyRef.current || stabilityRef.current) return false;
      const a = decksRef.current[i];
      const b = decksRef.current[refIndex];
      const da = decksStateRef.current[i];
      const db = decksStateRef.current[refIndex];
      if (!a || !b || !da?.track || !db?.track || !da.bpm || !db.bpm) return false;

      const result = alignAudioBeats(a.audio, b.audio, da, db, options);
      if (!result) return false;
      patchDeck(i, result);
      return true;
    },
    [patchDeck]
  );

  const { automateDeckEq, automateDeckFx, automateDeckFilter, resetDeckAutomation, automateDeckPerformance, resetDeckPerformance, getDeckPerformance, getPerformanceStage } =
    useDeckAutomation({ ctxRef, decksRef, decksStateRef, xGainsRef, patchDeck, ramp, stabilityRef });

  /* ------------------------- Master ------------------------- */

  const setCrossfade = useCallback(
    (x) => {
      const ctx = ctxRef.current;
      const p0 = xGainsRef.current[0]?.gain;
      const p1 = xGainsRef.current[1]?.gain;
      if (ctx) {
        holdAudioParameter(p0, ctx.currentTime);
        holdAudioParameter(p1, ctx.currentTime);
      }
      crossfadeMotionRef.current = null;
      crossRef.current = x;
      setCrossfadeState(x);
      ramp(p0, Math.cos((x * Math.PI) / 2), 0.02);
      ramp(p1, Math.cos(((1 - x) * Math.PI) / 2), 0.02);
    },
    [ramp]
  );

  // Crossfade programat pe ceasul audio: fade-ul e calculat de motorul de sunet,
  // nu de cronometrele paginii, deci rămâne perfect lin și cu fila în fundal.
  const crossfadeOver = useCallback((x, seconds, delay = 0) => {
    const target = Math.max(0, Math.min(1, x)), ctx = ctxRef.current;
    if (!ctx) return;
    const duration = seconds || 0.05;
    crossfadeMotionRef.current = { target, end: ctx.currentTime + Math.max(0, delay) + Math.max(0.05, duration) };
    scheduleCrossfade(ctx, xGainsRef.current[0]?.gain, xGainsRef.current[1]?.gain, target, duration, delay);
  }, []);

  const setLimiter = useCallback(
    (on) => {
      setLimiterOnState(on);
      ramp(limInRef.current?.gain, on ? 1 : 0, 0.05);
      ramp(bypassGainRef.current?.gain, on ? 0 : 1, 0.05);
    },
    [ramp]
  );

  const applyLimiterState = useCallback(
    (on) => {
      ramp(limInRef.current?.gain, on ? 1 : 0, 0.05);
      ramp(bypassGainRef.current?.gain, on ? 0 : 1, 0.05);
    },
    [ramp]
  );

  // Îmbunătățirile de sunet pe master: aplicate imediat, reținute local.
  const setMasterEnhance = useCallback((patch) => {
    const next = { ...masterEnhanceRef.current, ...patch };
    masterEnhanceRef.current = next;
    masterChainRef.current?.apply(next);
    storeMaster(next);
    setMasterEnhanceState(next);
  }, []);

  const applyMasterPreset = useCallback(
    (id) => {
      const preset = MASTER_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      setMasterEnhance({ ...preset.values, enabled: true });
      // Crystal Clear pornește cu protecția de vârf activă, fără compresie permanentă.
      if (id === 'crystal') setLimiter(true);
    },
    [setMasterEnhance, setLimiter]
  );

  // Bypass audio complet: EQ 0, efecte 0, filtru allpass, trim 1, tempo 1, limiter oprit.
  // Nu atinge state-ul React (reglajele utilizatorului rămân vizibile și se restaurează).
  const applyNeutralAudio = useCallback(() => {
    decksRef.current.forEach((n) => {
      if (n) resetDeckNode(n, ramp);
    });
    // „Sunet original” oprește și lanțul de masterizare, nu doar limiter-ul.
    masterChainRef.current?.apply({ ...masterEnhanceRef.current, enabled: false });
    applyLimiterState(false);
  }, [ramp, applyLimiterState]);

  // Reaplică reglajele utilizatorului din state pe noduri (fără limiter).
  const applyProcessedAudio = useCallback(() => {
    decksRef.current.forEach((n, i) => {
      if (!n) return;
      const d = decksStateRef.current[i];
      if (d) applyDeckState(n, ramp, d);
    });
    masterChainRef.current?.apply(masterEnhanceRef.current);
  }, [ramp]);

  const enableDjProcessing = useCallback(() => {
    if (emergencyRef.current || stabilityRef.current) return;
    neutralSnapLimiterRef.current = null;
    setNeutralState(false);
    setAbBypassState(false);
    setLimiterOnState(true);
    applyProcessedAudio();
    applyLimiterState(true);
  }, [applyProcessedAudio, applyLimiterState]);

  const setNeutral = useCallback(
    (on) => {
      if (on) {
        neutralSnapLimiterRef.current = limiterOn;
        applyNeutralAudio();
        setLimiterOnState(false);
      } else {
        applyProcessedAudio();
        const restoreLimiter = neutralSnapLimiterRef.current ?? true;
        setLimiterOnState(restoreLimiter);
        applyLimiterState(restoreLimiter);
        neutralSnapLimiterRef.current = null;
      }
      setNeutralState(on);
    },
    [applyNeutralAudio, applyProcessedAudio, applyLimiterState, limiterOn]
  );

  // Comparație A/B instantanee: B = fidel (bypass), A = procesat (starea ta).
  // Nu modifică controalele vizibile; la revenirea la A reaplică din state.
  const setAbBypass = useCallback(
    (on) => {
      if (on) {
        applyNeutralAudio();
      } else if (neutral) {
        applyNeutralAudio();
      } else {
        applyProcessedAudio();
        applyLimiterState(limiterOn);
      }
      setAbBypassState(on);
    },
    [applyNeutralAudio, applyProcessedAudio, applyLimiterState, neutral, limiterOn]
  );

  const panicStop = useCallback(() => {
    playbackEpochRef.current += 1;
    cancelDeckStarts();
    cancelCalibration();
    decksRef.current.forEach((n) => {
      if (!n) return;
      try {
        n.audio.pause();
      } catch (e) {
        /* ignore */
      }
    });
    // Emergency mute never overwrites the user's saved or locked level.
    muteSpeakerPlayback(ctxRef.current, outputsRef.current, defaultGainRef.current);
    muteMasterVolume();
    setDecks((prev) => prev.map((d) => ({ ...d, isPlaying: false, starting: false })));
  }, [muteMasterVolume, cancelCalibration, cancelDeckStarts]);

  const setEmergencyPlayback = useCallback((enabled) => {
    if (isCalibrating()) throw new Error('Oprește calibrarea înainte de a schimba traseul audio.');
    ensureContext();
    if (emergencyRef.current === enabled) return;
    emergencyRef.current = enabled;
    setLocalAnalysisPaused(enabled || stabilityRef.current);
    emergencyMasterRef.current(enabled);
    decksRef.current.forEach((node) => setEmergencyDeckRoute(node, enabled));
    outputsRef.current.forEach((output) => setEmergencyOutputRoute(postRef.current, output, enabled));
    applyCueDevice(enabled ? null : cueDeviceRef.current);
    setDecks((prev) => prev.map((deck, i) => ({ ...deck,
      tempo: decksRef.current[i].audio.playbackRate, analyzing: enabled ? false : deck.analyzing,
    })));
    setEmergencyPlaybackState(enabled);
    snapshotOutputs();
    if (!enabled) decksStateRef.current.forEach((deck, i) => {
      if (deck.track) analyze(i, deck.track);
    });
  }, [ensureContext, isCalibrating, applyCueDevice, snapshotOutputs, analyze]);

  /* ------------------------- Ieșiri: API public ------------------------- */

  const setOutputs = useCallback(
    (speakers) => {
      speakers = [...new Map(speakers.map((speaker) => [speaker.deviceId, speaker])).values()];
      if (emergencyRef.current) speakers = speakers.slice(0, 1);
      const same = desiredSpeakersRef.current.length === speakers.length &&
        speakers.every((speaker) => {
          const saved = desiredSpeakersRef.current.find((item) => item.deviceId === speaker.deviceId);
          return saved && saved.available === speaker.available && saved.disconnected === speaker.disconnected;
        });
      desiredSpeakersRef.current = speakers;
      if (same && ctxRef.current && outputsRef.current.size === speakers.length &&
        [...outputsRef.current.values()].every((output) => !output.playback.failed)) return;
      return applyOutputs();
    },
    [applyOutputs]
  );

  const setOutputDelay = useCallback(
    (deviceId, ms) => {
      const o = outputsRef.current.get(deviceId);
      if (!o) return;
      const clamped = Math.max(0, Math.min(500, ms));
      o.delay = clamped;
      ramp(o.delayNode.delayTime, Math.min(0.999, clamped / 1000), 0.05);
      storeDelay(deviceId, clamped);
      snapshotOutputs();
    },
    [ramp, snapshotOutputs]
  );

  // Împărțirea sunetului: schimbă banda unei singure ieșiri, fără a atinge celelalte.
  const setOutputBand = useCallback(
    (deviceId, bandId) => {
      const o = outputsRef.current.get(deviceId);
      if (!o) return;
      const spec = getBand(bandId);
      if (o.filterA.type !== spec.a.type) o.filterA.type = spec.a.type;
      ramp(o.filterA.frequency, spec.a.freq, 0.05);
      if (spec.a.q) o.filterA.Q.value = spec.a.q;
      if (o.filterB.type !== spec.b.type) o.filterB.type = spec.b.type;
      ramp(o.filterB.frequency, spec.b.freq, 0.05);
      if (spec.b.q) o.filterB.Q.value = spec.b.q;
      ramp(o.bandGain.gain, spec.gain, 0.05);
      o.band = bandId;
      storeBand(deviceId, bandId);
      snapshotOutputs();
    },
    [ramp, snapshotOutputs]
  );

  const playTestTone = useCallback(
    async (deviceId, ms = 420, { level = 0.32 } = {}) => {
      if (isCalibrating()) return null;
      const ctx = await resume();
      if (isCalibrating()) return null;
      const targets = deviceId
        ? [outputsRef.current.get(deviceId)].filter(Boolean)
        : Array.from(outputsRef.current.values());

      if (deviceId && !targets.length) {
        throw new Error('Ieșirea nu mai este disponibilă. Reîmprospătează lista de boxe.');
      }
      if (targets.length === 0) {
        playBeep(ctx, defaultGainRef.current, ms, 900, null, null, { level });
        return null;
      }
      await Promise.all(targets.map((output) => output.playback.ready.catch(() => {})));
      const ready = targets.filter((output) => !output.playback.failed && output.playback.started);
      if (!ready.length) throw new Error('Boxa nu este pornită. Reîncearcă ieșirea înainte de semnalul de test.');
      ready.forEach((output) => playBeep(ctx, output.delayNode, ms, 900, null, null, { level }));
      return deviceId ? getOutputDiagnostics(deviceId) : null;
    },
    [resume, isCalibrating, getOutputDiagnostics]
  );

  /**
   * Mostră de muzică generată local, pe aceeași ramură ca semnalul de test.
   * Folosită pentru a compara „se aude muzica” cu „se aude bipul” pe aceeași boxă.
   */
  const playOutputSample = useCallback(
    async (deviceId, { level = 0.3, ms = 1800 } = {}) => {
      if (isCalibrating()) throw new Error('Oprește calibrarea înainte de mostră.');
      const ctx = await resume();
      if (isCalibrating()) throw new Error('Oprește calibrarea înainte de mostră.');
      const output = outputsRef.current.get(deviceId);
      if (!output) throw new Error('Ieșirea nu mai este disponibilă. Reîmprospătează lista de boxe.');
      await output.playback.ready.catch(() => {});
      if (output.playback.failed) throw new Error(output.playback.stats.error || 'Boxa nu este pornită.');
      if (!output.playback.started) throw new Error('Boxa nu este pornită. Reîncearcă ieșirea înainte de mostră.');
      const handle = await startBeat(ctx, output.delayNode, { level });
      window.setTimeout(() => handle.stop(), ms);
      return getOutputDiagnostics(deviceId);
    },
    [resume, isCalibrating, getOutputDiagnostics]
  );

  const { beatTest, testBeat, stopTestBeat } = useBeatTest({
    resume, isCalibrating, postRef, defaultGainRef, outputsRef,
  });

  /* ------------------------- Test izolat ------------------------- */

  // Izolează o singură ieșire (delay 0) și trece deck-urile pe procesare neutră:
  // tempo original, EQ neutru, efecte oprite. Fără alte ieșiri active, fără dublare.
  const startIsolatedAudition = useCallback(
    async (deviceId) => {
      if (isCalibrating()) return;
      await resume();
      if (isCalibrating()) return;
      if (!auditionRef.current) {
        auditionRef.current = { deviceId: null, speakers: desiredSpeakersRef.current };
      }
      auditionRef.current.deviceId = deviceId;
      desiredSpeakersRef.current = [{ deviceId }];
      await applyOutputs();
      applyNeutralAudio();
      decksRef.current.forEach((n) => {
        if (n) n.audio.playbackRate = 1;
      });
      snapshotOutputs();
    },
    [resume, applyOutputs, applyNeutralAudio, snapshotOutputs, isCalibrating]
  );

  const stopIsolatedAudition = useCallback(() => {
    const backup = auditionRef.current;
    if (!backup) return;
    auditionRef.current = null;
    desiredSpeakersRef.current = backup.speakers;
    applyOutputs();
    const o = outputsRef.current.get(backup.deviceId);
    if (o) {
      const ms = readStoredDelay(backup.deviceId);
      o.delay = ms;
      ramp(o.delayNode.delayTime, Math.min(0.999, ms / 1000), 0.05);
    }
    applyProcessedAudio();
    applyLimiterState(limiterOn);
    snapshotOutputs();
  }, [applyOutputs, ramp, applyProcessedAudio, applyLimiterState, limiterOn, snapshotOutputs]);

  /* ------------------------- Contoare de nivel ------------------------- */



  const getRecordStream = useCallback(async () => {
    if (stabilityRef.current) return null;
    await resume();
    if (stabilityRef.current) return null;
    return recordDestRef.current ? recordDestRef.current().stream : null;
  }, [resume]);

  const { getDeckAudio, getDeckMixGain, getMasterInput, getAudioContext, isPlaybackActive } =
    useDeckPlaybackAccess(decksRef, xGainsRef, { masterRef, ctxRef, movieRef });

  // Nodurile de ieșire, expuse pentru alinierea automată cu microfonul.
  const getOutputNodes = useCallback(
    () =>
      Array.from(outputsRef.current.values()).map((o) => ({
        deviceId: o.deviceId,
        input: o.delayNode,
        gain: o.outGain,
      })),
    []
  );

  const resetMix = useCallback(() => {
    decksRef.current.forEach((n) => {
      if (!n) return;
      resetDeckNode(n, ramp);
      applyLoop(n, null, false, 0);
    });
    setDecks((prev) =>
      prev.map((d) => ({
        ...d,
        eq: { low: 0, mid: 0, high: 0 },
        tempo: 1,
        volume: 0.8,
        trim: 1,
        repeat: false,
        loop: null,
        fx: { echo: 0, reverb: 0, filter: 0, karaoke: 0 },
      }))
    );
    crossfadeMotionRef.current = null;
    crossRef.current = 0.5;
    setCrossfadeState(0.5);
    ramp(xGainsRef.current[0]?.gain, Math.SQRT1_2);
    ramp(xGainsRef.current[1]?.gain, Math.SQRT1_2);
    // Reset mixing controls, never the chosen output volume or its lock.
    setLimiter(true);
    setNeutralState(false);
  }, [ramp, setLimiter, applyLoop]);



  const playbackProtection = useSpeakerPlaybackWatchdog(outputsRef, ctxRef, decksRef, movieRef, engineContext, applyOutputs, stabilityMode, desiredSpeakersRef);

  useAudioDiagnostics({ engineContext, decksRef });

  useAudioEngineLifetime({ ctxRef, outputsRef, cueAudioRef, decksRef, decksStateRef,
    routingRef: outputRoutingRef, epochRef: playbackEpochRef, cancelDeckStarts });

  return {
    ready,
    audioContext: engineContext,
    stabilityMode,
    setStabilityMode,
    isStabilityMode,
    emergencyPlayback,
    isEmergencyPlayback,
    setEmergencyPlayback,
    isDirectOutput: (id) => !!outputsRef.current.get(id)?.playback.direct,
    playbackProtection,
    isPlaybackActive,
    calibrationBusy,
    calibrateOutputs,
    alignOutputs,
    alignWithPhone,
    retryPhoneBox,
    cancelCalibration,
    isCalibrating,
    outputCount,
    outputError,
    playbackError,
    outputs: outputsList,
    outputVolumes,
    setOutputVolume,
    decks,
    crossfade,
    masterVolume,
    volumeLock,
    toggleVolumeLock,
    limiterOn,
    neutral,
    cueDevice,
    cueVolume,
    setCueDevice,
    setCueVolume,
    toggleMonitor,
    setKeyLock,
    loadTrack,
    togglePlay,
    seek,
    setTempo,
    setEq,
    setDeckVolume,
    setDeckTrim,
    setFx,
    resetFx,
    setCue,
    cueAction,
    setHotCue,
    jumpHotCue,
    clearHotCue,
    setRepeat,
    setLoopBoundary,
    beatLoop,
    clearLoop,
    setDeckBpm,
    setDeckBeatOffset,
    resetBeatOffset,
    syncDeck,
    beatAlign,
    automateDeckEq,
    automateDeckFx,
    automateDeckFilter,
    resetDeckAutomation,
    automateDeckPerformance,
    getPerformanceStage,
    attachMovieElement,
    detachMovie,
    resetDeckPerformance,
    getDeckPerformance,
    enableDjProcessing,
    getOutputNodes,
    setCrossfade,
    crossfadeOver,
    getDeckAudio,
    getDeckMixGain,
    setMasterVolume,
    setLimiter,
    masterEnhance,
    setMasterEnhance,
    applyMasterPreset,
    setNeutral,
    abBypass,
    setAbBypass,
    panicStop,
    setOutputs,
    retryOutput,
    forceSystemOutput,
    getOutputLevel,
    getOutputDiagnostics,
    setOutputDelay,
    setOutputBand,
    playTestTone,
    playOutputSample,
    beatTest,
    testBeat,
    stopTestBeat,
    startIsolatedAudition,
    stopIsolatedAudition,
    getDeckMeter,
    getMasterMeter,
    getPreLimiterMeter,
    getPostLimiterMeter,
    getLimiterReduction,
    getSpectrum,
    getRecordStream,
    getMasterInput,
    getAudioContext,
    ensureAudio: resume,
    resetMix,
  };
}