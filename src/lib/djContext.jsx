import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDjEngine } from "@/hooks/useDjEngine";
import { useRecorder } from "@/hooks/useRecorder";
import { useSampler } from "@/hooks/useSampler";
import { useAutoDj } from "@/hooks/useAutoDj";
import { usePartyMode } from "@/hooks/usePartyMode";
import { useMobilePlayback } from "@/hooks/useMobilePlayback";
import useEmergencyPlayback from '@/hooks/useEmergencyPlayback';
import MediaSessionBridge from "@/components/audio/MediaSessionBridge";
import RemoteBridge from "@/components/remote/RemoteBridge";
import StabilityPlayback from '@/components/audio/StabilityPlayback';
import { RepeatLockProvider } from '@/components/mixer/RepeatLockProvider';
import { getTracks, saveTrack, removeTrack, updateTrack } from "@/lib/trackStore";
import { SYSTEM_DEFAULT_ID, SYSTEM_DEFAULT_OUTPUT, dropCommunicationsIfAlternative } from "@/lib/outputs";

const DjContext = createContext(null);
const SELECTED_KEY = "musicsync.selectedOutputs";
const MODE_KEY = "musicsync.outputMode";

const readOutputMode = () => {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === 'system' || saved === 'separate') return saved;
    const selection = JSON.parse(localStorage.getItem(SELECTED_KEY) || '[]');
    return Array.isArray(selection) && selection.some((id) => id !== SYSTEM_DEFAULT_ID) ? 'separate' : 'system';
  } catch (e) {
    return 'system';
  }
};
/**
 * Motor audio persistent: trăiește deasupra paginilor, deci navigarea
 * nu oprește redarea, nu recreează AudioContext-ul și nu pierde reglajele.
 * Aici stau și ieșirile selectate + biblioteca, ca să supraviețuiască navigării.
 */
export function DjProvider({ children }) {
  const dj = useDjEngine();
  const recorder = useRecorder(dj);
  const sampler = useSampler(dj);

  const [advanced, setAdvancedState] = useState(() => {
    try {
      return localStorage.getItem("musicsync.advanced") === "1";
    } catch (e) {
      return false;
    }
  });

  const setAdvanced = useCallback((v) => {
    setAdvancedState(v);
    try {
      localStorage.setItem("musicsync.advanced", v ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }, []);

  const [speakers, setSpeakers] = useState([]);
  const speakerCatalogRef = useRef(new Map());
  const [selectedSpeakers, setSelectedSpeakers] = useState([]);
  const [outputMode, setOutputModeState] = useState(readOutputMode);
  const outputModeRef = useRef(outputMode);
  outputModeRef.current = outputMode;
  const selectedRef = useRef(selectedSpeakers);
  selectedRef.current = selectedSpeakers;
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [labelRequestNotice, setLabelRequestNotice] = useState(null);
  const [tracks, setTracks] = useState([]);
  // Coada manuală din player: piesele adăugate din Bibliotecă, în ordinea aleasă.
  const [playQueue, setPlayQueue] = useState([]);
  // Playlistul local și motorul persistent sunt ambele disponibile Auto DJ-ului.
  const autoDj = useAutoDj(dj, tracks);
  const partyMode = usePartyMode(dj, autoDj);
  // Telefon: ecranul rămâne aprins la mixaj, sesiunea audio supraviețuiește
  // blocării ecranului, iar la redeschidere piesa revine de unde a rămas.
  const mobile = useMobilePlayback(dj, autoDj, tracks);
  const [pickerDeck, setPickerDeck] = useState(null);

  const calibrateOutputs = useCallback((options) => {
    if (autoDj.on || partyMode.on) {
      throw new Error('Oprește Auto DJ și modul Petrecere înainte de calibrare. Redarea nu va fi întreruptă.');
    }
    if (dj.isEmergencyPlayback?.() || dj.isStabilityMode?.()) {
      throw new Error('Revino la modul normal de redare înainte de calibrare.');
    }
    return dj.calibrateOutputs(options);
  }, [autoDj.on, partyMode.on, dj.calibrateOutputs, dj.isEmergencyPlayback, dj.isStabilityMode]);

  const alignOutputs = useCallback((options) => {
    if (autoDj.on || partyMode.on) {
      throw new Error('Oprește Auto DJ și modul Petrecere înainte de aliniere. Redarea nu va fi întreruptă.');
    }
    if (dj.isEmergencyPlayback?.() || dj.isStabilityMode?.()) {
      throw new Error('Revino la modul normal de redare înainte de aliniere.');
    }
    return dj.alignOutputs(options);
  }, [autoDj.on, partyMode.on, dj.alignOutputs, dj.isEmergencyPlayback, dj.isStabilityMode]);

  const alignWithPhone = useCallback((options) => {
    if (autoDj.on || partyMode.on) {
      throw new Error('Oprește Auto DJ și modul Petrecere înainte de alinierea cu telefonul. Redarea nu va fi întreruptă.');
    }
    if (dj.isEmergencyPlayback?.() || dj.isStabilityMode?.()) {
      throw new Error('Revino la modul normal de redare înainte de alinierea cu telefonul.');
    }
    return dj.alignWithPhone(options);
  }, [autoDj.on, partyMode.on, dj.alignWithPhone, dj.isEmergencyPlayback, dj.isStabilityMode]);

  const retryPhoneBox = useCallback((options) => {
    if (autoDj.on || partyMode.on) {
      throw new Error('Oprește Auto DJ și modul Petrecere înainte de reîncercare.');
    }
    if (dj.isEmergencyPlayback?.() || dj.isStabilityMode?.()) {
      throw new Error('Revino la modul normal de redare înainte de reîncercare.');
    }
    return dj.retryPhoneBox(options);
  }, [autoDj.on, partyMode.on, dj.retryPhoneBox, dj.isEmergencyPlayback, dj.isStabilityMode]);

  /** O singură sursă pentru selecție: menține și modul „sistem / separat” coerent. */
  const applySelection = useCallback((next) => {
    setSelectedSpeakers(next);
    try {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
    const mode = next.some((id) => id !== SYSTEM_DEFAULT_ID) ? 'separate' : 'system';
    setOutputModeState(mode);
    outputModeRef.current = mode;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const setOutputMode = useCallback((mode) => {
    setOutputModeState(mode);
    outputModeRef.current = mode;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (e) {
      /* ignore */
    }
    // Comutarea pe „separate" nu oprește sunetul: ieșirea curentă rămâne
    // activă până alegi boxele individuale.
    if (mode === 'system') applySelection([SYSTEM_DEFAULT_ID]);
  }, [applySelection]);

  /** Fallback explicit: lasă sistemul să redea, cu volumul revenit treptat. */
  const continueOnSystem = useCallback(() => {
    applySelection([SYSTEM_DEFAULT_ID]);
    return dj.forceSystemOutput();
  }, [applySelection, dj.forceSystemOutput]);

  const setSinkSupported = useMemo(
    () =>
      typeof HTMLMediaElement !== "undefined" &&
      typeof HTMLMediaElement.prototype.setSinkId === "function",
    []
  );

  /* ---------------- Ieșiri audio ---------------- */

  const refreshSpeakers = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setLoadingDevices(true);
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const outs = devs
        .filter((d) => d.kind === "audiooutput" && d.deviceId !== "default" && d.deviceId !== "communications")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || "Boxă (nume ascuns până permiți accesul)",
        }));
      // Device-label refreshes must not rebuild an already-playing route.
      const next = [SYSTEM_DEFAULT_OUTPUT, ...outs];
      next.forEach((speaker) => speakerCatalogRef.current.set(speaker.deviceId, speaker));
      setSpeakers((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  // Cerere explicită de permisiune — doar când utilizatorul apasă, ca să vedem numele boxelor.
  // Nu cerem microfonul în fundal și nu-l păstrăm activ: fluxul e deschis o singură dată,
  // pentru enumerarea dispozitivelor, și închis imediat (altfel unele boxe Bluetooth rămân
  // blocate în modul de apel). Redarea muzicii nu depinde niciodată de un microfon activ.
  const requestLabels = useCallback(async () => {
    if (dj.isPlaybackActive() || autoDj.on || partyMode.on || dj.calibrationBusy) {
      setLabelRequestNotice('Numele boxelor se identifică înainte de set. Microfonul nu a fost deschis, ca să nu întrerupă sunetul Bluetooth.');
      await refreshSpeakers();
      return;
    }
    setLabelRequestNotice(null);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      /* refuzat — rămân etichetele generice */
    } finally {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    }
    await refreshSpeakers();
  }, [refreshSpeakers, dj.isPlaybackActive, autoDj.on, partyMode.on, dj.calibrationBusy]);

  useEffect(() => {
    refreshSpeakers();
    const handler = () => refreshSpeakers();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshSpeakers]);

  // Reține ieșirea preferată și o restaurează doar dacă e disponibilă
  useEffect(() => {
    if (!speakers.length) return;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(SELECTED_KEY) || "[]");
    } catch (e) {
      saved = [];
    }
    const known = saved.filter((id) => speakers.some((s) => s.deviceId === id));
    // Nu reactivăm automat o ieșire de comunicații când dispozitivul are și o variantă de redare.
    const clean = dropCommunicationsIfAlternative(known, speakers);
    const separate = clean.filter((id) => id !== SYSTEM_DEFAULT_ID);
    const fallback = speakers.some((s) => s.deviceId === SYSTEM_DEFAULT_ID) ? [SYSTEM_DEFAULT_ID] : [];
    // În modul separat, până alegi o boxă individuală, ieșirea sistemului rămâne
    // activă — comutarea modului nu oprește sunetul.
    const available = outputModeRef.current === 'system'
      ? fallback
      : (separate.length ? separate : fallback);
    if (available.length) {
      setSelectedSpeakers((prev) => (prev.length ? prev : available));
    }
  }, [speakers]);

  const toggleSpeaker = useCallback((id) => {
    const prev = selectedRef.current;
    // The default output aliases a physical speaker: never play both paths.
    const next = dj.isEmergencyPlayback() ? [id] : prev.includes(id) ? prev.filter((x) => x !== id)
      : id === SYSTEM_DEFAULT_ID ? [SYSTEM_DEFAULT_ID]
        : [...prev.filter((x) => x !== SYSTEM_DEFAULT_ID), id];
    applySelection(next);
  }, [applySelection]);

  // Selectează/deselectează toate ieșirile detectate dintr-o singură apăsare.
  const setAllSpeakers = useCallback((ids) => {
    if (dj.isEmergencyPlayback()) ids = ids.slice(0, 1);
    const next = ids.some((id) => id !== SYSTEM_DEFAULT_ID)
      ? ids.filter((id) => id !== SYSTEM_DEFAULT_ID) : ids;
    applySelection(next);
  }, [applySelection]);

  const selectedSpeakerObjs = useMemo(
    // Device discovery can temporarily omit a Bluetooth/HDMI endpoint. It must
    // not be interpreted as the user deselecting it and closing its live stream.
    () => selectedSpeakers.map((deviceId) => {
      const live = speakers.find((speaker) => speaker.deviceId === deviceId);
      if (live) return { ...live, available: true, disconnected: false };
      const cached = speakerCatalogRef.current.get(deviceId) || { label: 'Boxă selectată' };
      return { ...cached, deviceId, available: false, disconnected: true };
    }),
    [speakers, selectedSpeakers]
  );

  const setOutputs = dj.setOutputs;
  useEffect(() => {
    setOutputs(selectedSpeakerObjs);
  }, [selectedSpeakerObjs, setOutputs]);

  /* ---------------- Bibliotecă ---------------- */

  const urlsRef = useRef([]);
  const libraryLifetimeRef = useRef(0);
  const libraryLoadedRef = useRef(false);

  useEffect(() => {
    const lifetime = ++libraryLifetimeRef.current;
    let cancelled = false;
    if (!libraryLoadedRef.current) getTracks().then((list) => {
      if (cancelled) return;
      const withUrls = list.map((t) => {
        const url = URL.createObjectURL(t.blob);
        urlsRef.current.push(url);
        return { id: t.id, name: t.name, size: t.size, favorite: !!t.favorite, addedAt: t.addedAt, bpmHint: t.bpmHint || null, url };
      });
      libraryLoadedRef.current = true;
      setTracks(withUrls);
    });
    return () => {
      cancelled = true;
      // Effect refreshes retain the provider and its live deck URLs. Dispose
      // only if this instance really unmounts, not during a cleanup/setup pair.
      queueMicrotask(() => {
        if (libraryLifetimeRef.current !== lifetime) return;
        urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        urlsRef.current = [];
      });
    };
  }, []);

  const addFiles = useCallback(async (fileList, options = {}) => {
    const files = Array.from(fileList || []).filter(
      (f) => f && (f.type.startsWith("audio/") || /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|aif|aiff)$/i.test(f.name))
    );
    const added = [];
    for (const f of files) {
      const rec = await saveTrack(f, options);
      const url = URL.createObjectURL(rec.blob);
      urlsRef.current.push(url);
      added.push({ id: rec.id, name: rec.name, size: rec.size, favorite: false, addedAt: rec.addedAt, bpmHint: rec.bpmHint || null, url });
    }
    if (added.length) setTracks((prev) => [...added, ...prev]);
    return added;
  }, []);

  const removeTrackById = useCallback(async (id) => {
    setTracks((prev) => prev.filter((x) => x.id !== id));
    await removeTrack(id);
  }, []);

  const toggleFavorite = useCallback(async (id) => {
    let next = false;
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        next = !t.favorite;
        return { ...t, favorite: next };
      })
    );
    await updateTrack(id, { favorite: next });
  }, []);

  const enqueueTrack = useCallback((track) => {
    if (!track?.id) return;
    setPlayQueue((prev) => (prev.some((item) => item.id === track.id) ? prev : [...prev, track]));
  }, []);

  const removeQueuedTrack = useCallback((id) => {
    setPlayQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearPlayQueue = useCallback(() => setPlayQueue([]), []);

  const loadToDeck = useCallback(
    (deckIndex, track) => {
      dj.loadTrack(deckIndex, track);
    },
    [dj]
  );

  // „Oprește tot sunetul" oprește și Auto DJ-ul, altfel acesta ar reporni singur.
  const stopEverything = useCallback(() => {
    partyMode.setOn(false);
    autoDj.setOn(false);
    dj.panicStop();
  }, [partyMode.setOn, autoDj.setOn, dj.panicStop]);

  const emergency = useEmergencyPlayback({ dj, autoDj, partyMode, tracks, speakers,
    selectedSpeakers: selectedSpeakerObjs, setAllSpeakers });

  const value = {
    ...dj,
    emergency,
    calibrateOutputs,
    alignOutputs,
    alignWithPhone,
    retryPhoneBox,
    panicStop: stopEverything,
    ...recorder,
    ...sampler,
    autoDj,
    partyMode,
    keepAwake: mobile.keepAwake,
    setKeepAwake: mobile.setKeepAwake,
    wakeLockActive: mobile.wakeLockActive,
    backgroundWakeSupported: mobile.backgroundWakeSupported,
    advanced,
    setAdvanced,
    deckCount: advanced ? 4 : 2,
    pickerDeck,
    setPickerDeck,
    speakers,
    selectedSpeakers,
    selectedSpeakerObjs,
    outputMode,
    setOutputMode,
    continueOnSystem,
    toggleSpeaker,
    setAllSpeakers,
    refreshSpeakers,
    requestLabels,
    labelRequestNotice,
    loadingDevices,
    setSinkSupported,
    tracks,
    addFiles,
    removeTrackById,
    toggleFavorite,
    loadToDeck,
    playQueue,
    enqueueTrack,
    removeQueuedTrack,
    clearPlayQueue,
  };

  return (
    <DjContext.Provider value={value}>
      <MediaSessionBridge />
      <RemoteBridge />
      <RepeatLockProvider>{dj.stabilityMode ? <StabilityPlayback /> : children}</RepeatLockProvider>
    </DjContext.Provider>
  );
}

export function useDj() {
  const ctx = useContext(DjContext);
  if (!ctx) throw new Error("useDj trebuie folosit în interiorul DjProvider");
  return ctx;
}