import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMixExit } from '@/components/audio/autoDjExitPlan';
import { interruptStarvedMix } from '@/components/audio/autoDjMixContinuity';
import { DJ_MAX_CONFIG } from '@/lib/djMaxConfig';
import { EMERGENCY_DJ_CONFIG } from '@/components/audio/emergencyDjConfig';
import { chooseMixStyle, mixDuration, previewMixDuration, MIX_STYLE_NAMES } from '@/lib/autoDjMixPlan';
import { waitForPlaybackReady } from '@/components/audio/autoDjPlayback';
import { scheduleTransitionAudio, restoreTransitionEq } from '@/lib/autoDjTransitionAudio';
import { prepareAutomaticTempo, recoverNaturalTempo } from '@/lib/autoDjTempoControl';
import { canMatchTempo } from '@/lib/autoDjTempo';
import { entryCue } from '@/lib/autoDjStructure';
import { selectAutoDjTrack, rejectAutoDjTrack, rerankQueue } from '@/lib/autoDjQueue';
import { playDeckAudio } from '@/lib/playDeckAudio';
import { scheduleDeckPerformance, resetPerformanceState } from '@/lib/autoDjPerformance';
import { loadTrackProfiles } from '@/lib/trackProfile';
import { beatDriftSeconds, driftTempo } from '@/lib/djMaxQuality';
import { scheduleUltraTransition } from '@/lib/ultraTransitionAudio';

/**
 * Auto DJ — rulează complet în browser, fără niciun apel extern și fără
 * credite de integrare. Analiza (BPM, beatgrid, nivel) se face local.
 *
 * Cum mixează, ca un DJ:
 *  1. cu ~60 s înainte de finalul piesei active încarcă următoarea pe celălalt
 *     deck, ca să apuce să fie analizată;
 *  2. alege o ieșire pe frază, din zonele liniștite ale piesei — nu taie refrenul;
 *  3. apropie tempo-urile treptat (speed-up / slow-down cu key lock), aliniază
 *     beat-urile și intră cu piesa nouă fără bass;
 *  4. face crossfade-ul constant-power programat pe ceasul audio, transferă bass-ul
 *     fără gol și păstrează tempo-ul piesei auzite stabil;
 *  5. fără BPM sigur sau fără zone libere, trece scurt și curat, fără sincronizare
 *     forțată și fără efecte peste piese.
 */

const CONFIG_KEY = "musicsync.autodj";
const PREPARE_LEAD = 90; // only the next deck is decoded; no live catalogue scans
const TICK_MS = 250;
const TRANSITIONS = ["smooth", "cut", "filter", "adaptive"];

const DEFAULTS = { ...DJ_MAX_CONFIG, on: false, shuffle: false };

/**
 * Cât mai e până când trebuie pornită tranziția, ca ea să se încheie pe un
 * început de măsură al piesei care iese, nu la mijlocul unei măsuri.
 */
function exitRemaining(deck, audio, crossfade, exitAt) {
  const rate = audio?.playbackRate || 1;
  const end = Number.isFinite(exitAt) ? exitAt : audio?.duration;
  if (!deck?.bpm || !Number.isFinite(end)) return crossfade;
  // Fraza are 8 măsuri. Încheind fade-ul pe un început de frază, piesa nouă
  // preia exact la început de propoziție muzicală, nu la jumătatea ei.
  const phrase = (240 / deck.bpm) * 8;
  const offset = deck.beatOffset || 0;
  const phrases = Math.floor((end - offset) / phrase);
  if (phrases < 1) return crossfade;
  const tail = (end - (offset + phrases * phrase)) / rate;
  return crossfade + Math.max(0, Math.min(tail, phrase / rate));
}

const readConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const silentUltra = parsed && (parsed.qualityVersion ?? 0) < 2 &&
      parsed.performanceMode === 'max' && parsed.intensity >= 0.8 && parsed.crossfade === 20;
    const mode = parsed?.performanceMode || (parsed?.performance === false ? 'balanced' : 'max');
    const maxMode = mode === 'max';
    // „on" nu se reține: sunetul are nevoie de o atingere din partea ta.
    return { ...DEFAULTS, ...(parsed || {}),
      // Repair the old silent Ultra preset once; retain subsequent manual choices.
      qualityVersion: DJ_MAX_CONFIG.qualityVersion,
      performance: silentUltra ? true : parsed?.performance ?? DEFAULTS.performance,
      transitionFx: silentUltra ? true : parsed?.transitionFx ?? DEFAULTS.transitionFx,
      intensity: Math.max(0.2, Math.min(1, Number(parsed?.intensity) || DEFAULTS.intensity)),
      performanceMode: mode,
      // Older MAX presets silently cut tracks after 64 bars. Migrate them to full-length playback.
      musicalVersion: DJ_MAX_CONFIG.musicalVersion,
      mixBars: parsed?.musicalVersion >= 3 ? parsed.mixBars ?? 0 : 0,
      // Reglajele de precizie MAX există din versiunea 3; cele vechi le primesc automat.
      driftLock: parsed?.driftLock ?? maxMode,
      eqCrossover: parsed?.eqCrossover ?? maxMode,
      smartSelect: parsed?.smartSelect ?? maxMode,
      choreography: parsed?.choreography ?? (maxMode && (parsed?.performance ?? false)),
      transition: TRANSITIONS.includes(parsed?.transition) ? parsed.transition : 'adaptive', on: false };
  } catch (e) {
    return { ...DEFAULTS };
  }
};

const storeConfig = (c) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, on: false }));
  } catch (e) {
    /* ignore */
  }
};

const idleStatus = (activeDeck, phase = "off") => ({
  phase,
  nextName: null,
  activeDeck,
  message: null,
  aligned: false,
});

export function useAutoDj(dj, tracks) {
  const djRef = useRef(dj);
  djRef.current = { ...dj, tracks };

  const [config, setConfigState] = useState(readConfig);
  const configRef = useRef(config);
  configRef.current = config;

  const [status, setStatus] = useState(() => idleStatus(0));
  const statusRef = useRef(status);

  const pushStatus = useCallback((next) => {
    const p = statusRef.current;
    if (
      p.phase === next.phase &&
      p.nextName === next.nextName &&
      p.activeDeck === next.activeDeck &&
      p.message === next.message &&
      p.aligned === next.aligned &&
      p.mixStyle === next.mixStyle
    ) {
      return;
    }
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stateRef = useRef({
    activeDeck: 0,
    phase: "idle", // idle | preparing | mixing
    incomingDeck: null,
    nextTrack: null,
    mixStart: 0,
    mixEnd: 0,
    busyUntil: 0,
    session: 0,
    controller: null,
    preparedAt: 0,
    activeLoadAt: 0,
    running: false,
    queue: [],
    recent: [],
    failures: 0,
    blocked: [],
    incomingTempo: null,
    exitPlan: null,
    tempoRamp: null,
    tempoPrepared: false,
    eqBaseline: null,
    eqScheduled: false,
    driftAt: 0,
    mixBaseTempo: null,
    // Optional subtle accents; no gain pumping or missed-beat catch-up.
    perf: { trackId: null, lastEvent: -Infinity, enabled: false },
  });

  // Coada vizibilă în interfață: piesa pregătită plus ce urmează în ordinea setului.
  const [upcoming, setUpcoming] = useState([]);

  // „Sari la următoarea": nu aștepta fereastra de crossfade, mixează imediat ce
  // piesa următoare e gata. Se resetează după fiecare tranziție.
  const forceRef = useRef(false);

  const refreshUpcoming = useCallback(() => {
    const st = stateRef.current;
    const list = [];
    if (st.nextTrack) list.push(st.nextTrack);
    st.queue.forEach((track) => {
      if (track.id !== st.nextTrack?.id) list.push(track);
    });
    const signature = list.map((track) => track.id).join("|");
    setUpcoming((previous) => (previous.map((track) => track.id).join("|") === signature ? previous : list));
  }, []);

  const setConfig = useCallback((patch) => {
    const next = { ...configRef.current, ...patch,
      ...(djRef.current.isEmergencyPlayback?.() ? EMERGENCY_DJ_CONFIG : {}) };
    if (patch.shuffle !== undefined) stateRef.current.queue = [];
    if (patch.performance === false || patch.transitionFx === false) {
      [0, 1].forEach((index) => djRef.current.resetDeckPerformance(index));
      resetPerformanceState(stateRef.current.perf);
    }
    configRef.current = next;
    if (!djRef.current.isEmergencyPlayback?.()) storeConfig(next);
    setConfigState(next);
    return next;
  }, []);

  /* ---------------- alegerea piesei următoare ---------------- */

  const pickNext = useCallback(() => {
    const st = stateRef.current;
    const d = djRef.current;
    const cfg = d.isStabilityMode?.() ? { ...configRef.current, ...EMERGENCY_DJ_CONFIG, shuffle: false } : configRef.current;
    const next = selectAutoDjTrack(st, d.tracks || [], cfg, d.decks[st.activeDeck]);
    refreshUpcoming();
    return next;
  }, [refreshUpcoming]);

  const remember = useCallback((track) => {
    const st = stateRef.current;
    st.recent = [track.id, ...st.recent].slice(0, 4);
    // Poziția în set hrănește curba de energie: urcuș, apoi revenire.
    st.played = (st.played || 0) + 1;
  }, []);

  /** Scoate o piesă din coadă; dacă era deja pregătită, deckul se oprește și se alege alta. */
  const removeQueued = useCallback((id) => {
    const st = stateRef.current;
    if (st.phase === 'mixing' && st.nextTrack?.id === id) return;
    st.queue = st.queue.filter((track) => track.id !== id);
    if (st.nextTrack?.id === id) {
      st.session += 1;
      st.controller?.abort();
      st.controller = new AbortController();
      djRef.current.getDeckAudio(st.incomingDeck)?.pause();
      st.phase = "idle";
      st.incomingDeck = null;
      st.nextTrack = null;
      st.busyUntil = 0;
      st.tempoPrepared = false;
      st.tempoRamp = null;
      if (!djRef.current.isStabilityMode?.()) recoverNaturalTempo(djRef.current, st, configRef.current);
    }
    refreshUpcoming();
  }, [refreshUpcoming]);

  /* ---------------- tranziția ---------------- */

  const startMix = useCallback(
    async (d, st, cfg, incoming) => {
      const other = st.incomingDeck;
      const b = d.getDeckAudio(other);
      if (!b) return;
      const session = st.session;
      const active = d.decks[st.activeDeck];
      const outgoing = d.getDeckAudio(st.activeDeck);
      const source = b.getAttribute('src');
      const isCurrent = () => !d.isCalibrating() && configRef.current.on && session === st.session && st.incomingDeck === other &&
        st.nextTrack?.id === incoming?.track?.id && b.getAttribute('src') === source;
      // Prepare speed while silent. No phase-feedback rate changes on audible audio.
      st.tempoRamp = null;
      d.resetDeckPerformance(other);
      resetPerformanceState(st.perf);
      const matched = canMatchTempo(active, incoming, outgoing, cfg);
      d.setKeyLock(other, true);
      d.setTempo(other, matched ? active.bpm * outgoing.playbackRate / incoming.bpm : 1);
      d.seek(other, d.isEmergencyPlayback?.() || d.isStabilityMode?.() ? 0 : entryCue(incoming));
      await waitForPlaybackReady(b, false, st.controller.signal);
      if (!isCurrent()) return;
      await playDeckAudio(b, st.controller.signal);
      await waitForPlaybackReady(b, true, st.controller.signal);
      if (!isCurrent()) {
        if (b.getAttribute('src') === source && (!configRef.current.on || d.isCalibrating())) b.pause();
        return;
      }
      // Account for startup buffering before alignment; the fader is still closed.
      const aligned = matched && !outgoing.paused && !outgoing.ended &&
        d.beatAlign(other, st.activeDeck, { silent: true });
      if (aligned) await waitForPlaybackReady(b, true, st.controller.signal);
      if (!isCurrent()) return;
      // A preset selected during buffering must control the actual transition.
      cfg = d.isStabilityMode?.() || d.isEmergencyPlayback?.()
        ? { ...configRef.current, ...EMERGENCY_DJ_CONFIG } : configRef.current;
      const style = chooseMixStyle(cfg, active, incoming, aligned);
      const beat = active?.bpm ? 60 / (active.bpm * outgoing.playbackRate) : 0.5;
      // Fade-ul se termină exact pe punctul de ieșire ales din muzică.
      const exitAt = resolveMixExit(st, active, outgoing, cfg);
      const xf = mixDuration(cfg, style, beat,
        Math.max(0, (exitAt - outgoing.currentTime) / outgoing.playbackRate),
        (b.duration - b.currentTime) / b.playbackRate, aligned, active, incoming);
      st.incomingTempo = b.playbackRate;
      st.mixBaseTempo = b.playbackRate;
      st.driftAt = 0;
      // No hidden eight-second lead: the entire fade must fit before the outgoing file ends.
      st.mixStart = d.getAudioContext().currentTime;
      scheduleTransitionAudio(d, st, cfg, style, xf, beat);
      d.crossfadeOver(other === 0 ? 0 : 1, xf);
      st.phase = "mixing";
      st.mixEnd = st.mixStart + xf;
      st.busyUntil = 0;
      st.failures = 0;
      pushStatus({
        phase: "mixing", nextName: st.nextTrack?.name || null,
        activeDeck: st.activeDeck, message: null, aligned,
        mixStyle: aligned ? MIX_STYLE_NAMES[style] : `${MIX_STYLE_NAMES[style]} · fără beatmatch`,
      });
    },
    [pushStatus]
  );

  const finishMix = useCallback(
    (d, st) => {
      d.setCrossfade(st.incomingDeck === 0 ? 0 : 1);
      const old = d.getDeckAudio(st.activeDeck);
      if (old && !old.paused) old.pause();
      // Keep engine state and the media tempo in agreement after phase correction.
      if (st.incomingTempo) d.setTempo(st.incomingDeck, st.incomingTempo);
      st.incomingTempo = null;
      st.tempoRamp = null;
      st.tempoPrepared = false;
      st.mixBaseTempo = null;
      st.driftAt = 0;
      resetPerformanceState(st.perf);
      // Deck-ul care a ieșit rămâne curat: EQ, filtru și efecte la reglajele lui.
      d.resetDeckAutomation(st.activeDeck);
      d.resetDeckPerformance(st.activeDeck);
      // Keep the incoming tone intact; the next tick continues from its actual values.
      st.activeDeck = st.incomingDeck ?? 1 - st.activeDeck;
      restoreTransitionEq(d, st);
      st.eqBaseline = null;
      st.filterBaseline = null;
      st.bassSwap = false;
      // Coada se reașază după noua piesă: setul urmează muzica, nu o listă veche.
      if (configRef.current.shuffle && !d.isStabilityMode?.()) {
        rerankQueue(st, d.tracks || [], configRef.current, d.decks[st.activeDeck]);
        refreshUpcoming();
      }
      if (!d.isStabilityMode?.()) recoverNaturalTempo(d, st, configRef.current);
      st.phase = "idle";
      st.exitPlan = null;
      st.incomingDeck = null;
      st.nextTrack = null;
      st.busyUntil = Date.now() + 250;
      forceRef.current = false;
      pushStatus(idleStatus(st.activeDeck, "playing"));
    },
    [pushStatus, refreshUpcoming]
  );

  /** Correct phase only while the incoming deck is silent: changing a live
   * media playbackRate repeatedly resets its pitch-preserving time stretcher. */
  const lockBeatPhase = useCallback((d, st, cfg) => {
    if (st.incomingDeck == null || !st.incomingTempo || !cfg.beatmatch) return;
    if (d.getDeckMixGain(st.incomingDeck) > 0.001) return;
    const ctx = d.getAudioContext();
    if (!ctx) return;
    const remaining = st.mixEnd - ctx.currentTime;
    if (remaining < 1.5) return;
    if (ctx.currentTime - (st.driftAt || 0) < 1.2) return;
    const incomingAudio = d.getDeckAudio(st.incomingDeck);
    const outgoingAudio = d.getDeckAudio(st.activeDeck);
    if (!incomingAudio || !outgoingAudio || incomingAudio.paused || outgoingAudio.paused) return;
    const error = beatDriftSeconds(
      d.decks[st.incomingDeck], incomingAudio,
      d.decks[st.activeDeck], outgoingAudio
    );
    if (error == null) return;
    const base = st.mixBaseTempo || incomingAudio.playbackRate;
    const corrected = driftTempo(incomingAudio.playbackRate, error, remaining);
    const tempo = Math.max(base * 0.996, Math.min(base * 1.004, corrected));
    if (Math.abs(tempo - incomingAudio.playbackRate) < 0.0004) return;
    st.incomingTempo = tempo;
    d.setTempo(st.incomingDeck, tempo);
    st.driftAt = ctx.currentTime;
  }, []);

  /** Retain matched tempo until the deck is silent. The former once-per-second
   * audible convergence kept reconfiguring the media decoder after every mix. */
  const convergeTempo = useCallback((d, st, cfg) => {
    if (cfg.performanceMode !== 'max' || !cfg.beatmatch || cfg.tempoConverge === false) return;
    const audio = d.getDeckAudio(st.activeDeck);
    if (!audio || audio.paused || audio.ended || d.getDeckMixGain(st.activeDeck) > 0.001) return;
    const distance = Math.abs(audio.playbackRate - 1);
    if (distance < 0.001 || distance > 0.04) return;
    const now = Date.now();
    if (now - (st.convergeAt || 0) < 950) return;
    const step = Math.min(distance, Math.max(0.0008, distance * 0.06));
    d.setTempo(st.activeDeck, audio.playbackRate + Math.sign(1 - audio.playbackRate) * step);
    st.convergeAt = now;
  }, []);

  /* ---------------- bucla de regie ---------------- */

  const tick = useCallback(async () => {
    const d = djRef.current;
    const st = stateRef.current;
    const cfg = d.isEmergencyPlayback?.() || d.isStabilityMode?.()
      ? { ...configRef.current, ...EMERGENCY_DJ_CONFIG } : configRef.current;
    const session = st.session;
    if (!cfg.on || d.isCalibrating() || st.phase === "error" || Date.now() < st.busyUntil) return;
    if (!st.controller) st.controller = new AbortController();
    if (d.getAudioContext()?.state === 'closed') {
      await d.ensureAudio();
      if (!configRef.current.on || session !== st.session) return;
      // A deadline belongs to its old audio clock. Finish the interrupted
      // transition once, then let the next tick start the restored deck.
      if (st.phase === 'mixing') finishMix(d, st);
      return;
    }
    if (st.phase === "mixing") {
      if (interruptStarvedMix(d, st)) {
        pushStatus({ ...idleStatus(st.activeDeck, 'preparing'), nextName: st.nextTrack?.name,
          message: 'Piesa următoare așteaptă date · păstrez piesa curentă.' });
        return;
      }
      if (cfg.performanceMode === 'max' && cfg.driftLock) lockBeatPhase(d, st, cfg);
      const outgoing = d.getDeckAudio(st.activeDeck);
      if (!outgoing?.ended && !outgoing?.error && d.getAudioContext().currentTime < st.mixEnd) return;
      finishMix(d, st);
      return;
    }
    convergeTempo(d, st, cfg);
    if (!d.tracks.length) {
      pushStatus({ ...idleStatus(st.activeDeck, "empty") });
      return;
    }
    const cur = d.decks[st.activeDeck];
    const a = d.getDeckAudio(st.activeDeck);
    if (!a) {
      pushStatus({ ...idleStatus(st.activeDeck, "starting"), message: "Pregătesc motorul audio…" });
      await d.ensureAudio();
      return;
    }
    if (!cur?.track || !a.src) {
      const track = pickNext();
      if (!track) {
        st.phase = 'error';
        pushStatus({ ...idleStatus(st.activeDeck, 'error'), message: 'Niciun fișier disponibil nu poate fi redat. Verifică biblioteca și repornește Auto DJ.' });
        return;
      }
      remember(track);
      st.activeLoadAt = Date.now();
      pushStatus({ ...idleStatus(st.activeDeck, "starting"), nextName: track.name });
      await d.loadTrack(st.activeDeck, track);
      if (!configRef.current.on || session !== st.session) return;
      st.busyUntil = Date.now() + TICK_MS;
      return;
    }
    if (a.error || st.blocked.includes(cur.track.id)) {
      // Fișier corupt: îl scoatem din set și continuăm cu următoarea piesă.
      rejectAutoDjTrack(st, cur.track.id);
      const replacement = pickNext();
      if (!replacement) {
        st.phase = 'error';
        pushStatus({ ...idleStatus(st.activeDeck, 'error'), message: 'Fișierele disponibile nu pot fi redate. Verifică biblioteca și repornește Auto DJ.' });
        return;
      }
      remember(replacement);
      pushStatus({
        ...idleStatus(st.activeDeck, "starting"), nextName: replacement.name,
        message: `„${cur.track.name}” nu poate fi redată · trec la următoarea.`,
      });
      st.activeLoadAt = Date.now();
      await d.loadTrack(st.activeDeck, replacement);
      if (!configRef.current.on || session !== st.session) return;
      st.busyUntil = Date.now() + TICK_MS;
      return;
    }
    if (a.paused && !a.ended) {
      if (cur.analyzing && Date.now() - st.activeLoadAt < 8000) {
        pushStatus({ ...idleStatus(st.activeDeck, 'starting'), message: 'Analizez piesa înainte de pornire…' });
        return;
      }
      await d.ensureAudio();
      if (!configRef.current.on || session !== st.session || d.isCalibrating()) return;
      await waitForPlaybackReady(a, false, st.controller.signal);
      if (!configRef.current.on || session !== st.session || d.isCalibrating()) return;
      await playDeckAudio(a, st.controller.signal);
      await waitForPlaybackReady(a, true, st.controller.signal);
      if (!configRef.current.on || session !== st.session) return;
    }
    if (!Number.isFinite(a.duration) || !a.duration) return;
    // Bypass is an explicit user choice; never schedule effects behind it.
    if (cfg.performance && !d.neutral && !d.abBypass && !a.paused) {
      const accent = scheduleDeckPerformance({
        stage: d.getPerformanceStage?.(st.activeDeck),
        ctx: d.getAudioContext(),
        deck: cur,
        audio: a,
        cfg,
        state: st.perf,
      });
      if (accent) d.automateDeckPerformance(st.activeDeck, accent);
    } else if (st.perf.enabled) {
      d.resetDeckPerformance(st.activeDeck);
      resetPerformanceState(st.perf);
    }
    // Decode only loaded decks. Live catalogue profiling competed with playback.
    // Freeze the exit deadline so it cannot move away on every scheduler tick.
    const exitAt = resolveMixExit(st, cur, a, cfg);
    const remaining = Math.max(0, (exitAt - a.currentTime) / a.playbackRate);
    if (st.phase === "idle") {
      if (remaining > cfg.crossfade + PREPARE_LEAD && !forceRef.current) {
        pushStatus(idleStatus(st.activeDeck, "playing"));
        return;
      }
      const next = pickNext();
      if (!next) return;
      st.nextTrack = next;
      st.incomingDeck = 1 - st.activeDeck;
      st.phase = "preparing";
      st.preparedAt = Date.now();
      remember(next);
      pushStatus({ ...idleStatus(st.activeDeck, "preparing"), nextName: next.name });
      // Analysis continues independently; never block the scheduler until the current track ends.
      await d.loadTrack(st.incomingDeck, next);
      if (!configRef.current.on || session !== st.session) return;
      st.busyUntil = Date.now() + TICK_MS;
      return;
    }
    if (st.phase === "preparing") {
      if (!d.tracks.some((track) => track.id === st.nextTrack?.id)) {
        st.phase = "idle";
        st.incomingDeck = null;
        st.nextTrack = null;
        return;
      }
      const b = d.getDeckAudio(st.incomingDeck);
      const incoming = d.decks[st.incomingDeck];
      const prepared = b && b.readyState >= 2 && incoming?.track?.id === st.nextTrack.id;
      if (b?.error || (!prepared && Date.now() - st.preparedAt > 20000)) {
        // A corrupt or permanently stalled preload must not strand the set.
        const name = st.nextTrack.name;
        rejectAutoDjTrack(st, st.nextTrack.id);
        b?.pause();
        st.phase = 'idle';
        st.incomingDeck = null;
        st.nextTrack = null;
        pushStatus({ ...idleStatus(st.activeDeck, 'playing'), message: `„${name}” nu este redabilă · aleg altă piesă.` });
        return;
      }
      if (!prepared) return;
      prepareAutomaticTempo(d, st, cfg, incoming);
      const forced = forceRef.current;
      const mixWindow = previewMixDuration(cfg, cur, incoming, a, b);
      // Pornim cu o frază mai devreme, cât să apuce fade-ul să se încheie pe un
      // început de frază al piesei care iese.
      const lead = d.isEmergencyPlayback?.() || d.isStabilityMode?.() ? mixWindow : exitRemaining(cur, a, mixWindow, exitAt);
      if (remaining > lead && !forced) return;
      // Analysis may finish later; keep the music moving with a clean, unforced fade at the deadline.
      if (incoming.analyzing && remaining > Math.max(2, mixWindow) && !forced) return;
      // Let a detected climax finish before starting the fade, when there is enough tail left.
      const protectedPeak = !d.isStabilityMode?.() && cur.structure?.events?.find((event) =>
        a.currentTime >= event.buildAt && a.currentTime < event.releaseAt);
      if (!forced && protectedPeak && protectedPeak.releaseAt < exitAt - mixWindow * a.playbackRate - 0.75 &&
        (a.duration - a.currentTime) / a.playbackRate > 2) {
        pushStatus({ ...idleStatus(st.activeDeck, 'preparing'), nextName: st.nextTrack?.name,
          message: 'Păstrez vârful piesei · mixez după el.' });
        return;
      }
      forceRef.current = false;
      await startMix(d, st, cfg, incoming);
    }
  }, [pickNext, remember, pushStatus, startMix, finishMix, lockBeatPhase, convergeTempo]);

  useEffect(() => {
    if (!config.on) {
      pushStatus(idleStatus(stateRef.current.activeDeck, "off"));
      return;
    }
    const run = async () => {
      const st = stateRef.current;
      const d = djRef.current;
      if (st.running) return;
      const session = st.session;
      st.running = true;
      try {
        await tick();
      } catch (error) {
        if (!configRef.current.on || session !== st.session) return;
        if (error.name === "NotAllowedError") {
          st.phase = "error";
          pushStatus({
            ...idleStatus(st.activeDeck, "error"),
            message: "Browserul a blocat redarea. Oprește și repornește Auto DJ pentru a permite sunetul.",
          });
          return;
        }
        const fileFailure = error.name === 'TrackPlaybackError' || error.name === 'NotSupportedError';
        if (fileFailure) {
          rejectAutoDjTrack(st, st.nextTrack?.id || d.decks[st.activeDeck]?.track?.id);
          st.failures = 0;
        } else st.failures = (st.failures || 0) + 1;
        if (st.phase === "mixing") {
          d.setCrossfade(st.activeDeck === 0 ? 0 : 1);
          d.getDeckAudio(st.incomingDeck)?.pause();
          d.resetDeckAutomation(st.activeDeck);
          [0, 1].forEach((index) => d.resetDeckPerformance(index));
          restoreTransitionEq(d, st);
        } else {
          d.getDeckAudio(st.incomingDeck)?.pause();
        }
        st.eqBaseline = null;
        st.bassSwap = false;
        st.incomingTempo = null;
          st.tempoRamp = null;
        st.tempoPrepared = false;
        resetPerformanceState(st.perf);
        st.incomingDeck = null;
        st.nextTrack = null;
        st.phase = "idle";
        forceRef.current = false;
        st.busyUntil = Date.now() + 2000;
        if (st.failures >= 3) {
          st.phase = "error";
          pushStatus({
            ...idleStatus(st.activeDeck, "error"),
            message: error.message || "Redarea nu a reușit de trei ori. Oprește și repornește Auto DJ.",
          });
        } else {
          pushStatus({
            ...idleStatus(st.activeDeck, "playing"),
            message: fileFailure ? 'Fișierul nu este redabil · trec la următoarea piesă.' : 'Redarea a fost întreruptă · reîncerc în câteva secunde.',
          });
        }
      } finally {
        st.running = false;
        refreshUpcoming();
      }
    };
    const events = ['waiting', 'stalled', 'error', 'pause', 'ended'];
    const sources = [0, 1].map((index) => djRef.current.getDeckAudio(index)).filter(Boolean);
    // Buffer loss can occur between scheduler ticks or while the tab is hidden.
    // Cancel the fade on the media event, not only on a throttled timer.
    const onTransportChange = () => { if (stateRef.current.phase === 'mixing') run(); };
    sources.forEach((audio) => events.forEach((event) => audio.addEventListener(event, onTransportChange)));
    const id = setInterval(run, TICK_MS);
    run();
    return () => {
      clearInterval(id);
      sources.forEach((audio) => events.forEach((event) => audio.removeEventListener(event, onTransportChange)));
      stateRef.current.controller?.abort();
    };
  }, [config.on, tick, pushStatus, refreshUpcoming]);

  // Read existing profiles once. New profiles are saved as decks are analysed.
  useEffect(() => { loadTrackProfiles(); }, []);

  const setOn = useCallback(
    (on) => {
      const st = stateRef.current;
      const d = djRef.current;
      if (on && d.isCalibrating()) return;
      if (!on && !configRef.current.on) return;
      forceRef.current = false;
      st.session += 1;
      st.controller?.abort();
      st.controller = new AbortController();
      if (!on && st.phase === 'mixing' && st.incomingDeck !== null) {
        const incomingAudio = d.getDeckAudio(st.incomingDeck);
        const middle = st.mixStart + (st.mixEnd - st.mixStart) / 2;
        if (incomingAudio && !incomingAudio.paused && !incomingAudio.ended &&
          d.getAudioContext().currentTime >= middle) st.activeDeck = st.incomingDeck;
      }
      if (on) {
        st.failures = 0;
        st.blocked = [];
        // Un set nou pornește de la începutul curbei de energie.
        st.played = 0;
        st.energyAverage = null;
        st.convergeAt = 0;
        d.ensureAudio();
        const a = d.getDeckAudio(0);
        const b = d.getDeckAudio(1);
        // Continue the audible deck instead of restarting an existing set on A.
        if (b && !b.paused && (!a || a.paused || d.crossfade >= 0.5)) st.activeDeck = 1;
        else if (a && !a.paused) st.activeDeck = 0;
        else if (!d.decks[st.activeDeck]?.track && d.decks[1 - st.activeDeck]?.track) st.activeDeck = 1 - st.activeDeck;
        d.decks.forEach((_, index) => {
          if (index !== st.activeDeck) d.getDeckAudio(index)?.pause();
        });
        d.clearLoop(st.activeDeck);
      }
      // Cancel remaining fades/EQ automation and return one clean deck to manual control.
      d.setCrossfade(st.activeDeck === 0 ? 0 : 1);
      // Efectele live se opresc întotdeauna: la oprire nu rămâne niciun bass/ecou aprins.
      [0, 1].forEach((index) => d.resetDeckPerformance(index));
      if (!on && st.incomingDeck !== null) {
        d.getDeckAudio(1 - st.activeDeck)?.pause();
        [0, 1].forEach((index) => d.resetDeckAutomation(index));
        restoreTransitionEq(d, st);
      }
      st.eqBaseline = null;
      st.filterBaseline = null;
      st.filterScheduled = false;
      st.bassSwap = false;
      st.phase = "idle";
      st.incomingDeck = null;
      st.nextTrack = null;
      st.busyUntil = 0;
      st.queue = [];
      st.exitPlan = null;
      st.incomingTempo = null;
      st.tempoRamp = null;
      st.tempoPrepared = false;
      resetPerformanceState(st.perf);
      refreshUpcoming();
      setConfig({ on });
    },
    [setConfig]
  );

  const startMax = useCallback((mode = DJ_MAX_CONFIG) => {
    const d = djRef.current;
    if (d.isCalibrating() || d.isEmergencyPlayback?.() || d.isStabilityMode?.()) return;
    d.ensureAudio();
    if (stateRef.current.phase === 'error') setOn(false);
    if (d.neutral || d.abBypass || !d.limiterOn) d.enableDjProcessing();
    setConfig(mode);
    if (!configRef.current.on) setOn(true);
    const st = stateRef.current, cfg = configRef.current;
    const ctx = d.getAudioContext(), audio = d.getDeckAudio(st.activeDeck);
    if (!cfg.performance || !ctx || !audio || audio.paused) return;
    // Applying Party MAX to a running set changes the sound now, not at the next file.
    if (st.phase === 'mixing') {
      const remaining = st.mixEnd - ctx.currentTime;
      if (remaining > 0.1) scheduleUltraTransition({ ...d, neutral: false, abBypass: false }, st, cfg,
        remaining, d.decks[st.activeDeck]?.bpm ? 60 / (d.decks[st.activeDeck].bpm * audio.playbackRate) : 0.5, 0);
    } else {
      const plan = scheduleDeckPerformance({ stage: d.getPerformanceStage(st.activeDeck), ctx,
        deck: d.decks[st.activeDeck], audio, cfg, state: st.perf });
      if (plan) d.automateDeckPerformance(st.activeDeck, plan);
    }
  }, [setOn, setConfig]);

  /** Sari la piesa următoare: pornește tranziția imediat ce e pregătită. */
  const skip = useCallback(() => {
    const st = stateRef.current;
    if (!configRef.current.on || st.phase === "error" || st.phase === 'mixing') return;
    forceRef.current = true;
    pushStatus({
      ...idleStatus(st.activeDeck, "preparing"),
      nextName: st.nextTrack?.name || null,
      message: "Trec la piesa următoare…",
    });
  }, [pushStatus]);

  const getExitPosition = useCallback(() => {
    const st = stateRef.current, d = djRef.current;
    return resolveMixExit(st, d.decks[st.activeDeck], d.getDeckAudio(st.activeDeck), configRef.current);
  }, []);

  return {
    on: config.on,
    getExitPosition,
    config,
    status,
    setOn,
    setConfig,
    startMax,
    skip,
    upcoming,
    removeQueued,
  };
}