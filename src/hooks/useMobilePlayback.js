import { useCallback, useEffect, useRef, useState } from 'react';

const SNAPSHOT_KEY = 'musicsync.session';
const AWAKE_KEY = 'musicsync.keepAwake';
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;
// Only older iOS needs a silent media keeper. Never open another default-device
// renderer on desktop/Android alongside the selected speaker outputs.
const LEGACY_IOS_KEEPER = typeof navigator !== 'undefined' && !navigator.audioSession &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const readSnapshot = () => {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
  } catch (e) {
    return null;
  }
};

const writeSnapshot = (value) => {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(value));
  } catch (e) {
    /* ignore */
  }
};

/** One-second silence used only to hold the phone's audio session open. */
function silentWavUrl(seconds = 1, rate = 8000) {
  const samples = Math.floor(seconds * rate);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

/**
 * Redare pe telefon: ține sesiunea audio deschisă cu ecranul stins, cere
 * wake lock cât timp mixezi și reia piesa de unde ai rămas la redeschidere.
 */
export function useMobilePlayback(dj, autoDj, tracks) {
  const [keepAwake, setKeepAwakeState] = useState(() => {
    try {
      return localStorage.getItem(AWAKE_KEY) !== '0';
    } catch (e) {
      return true;
    }
  });
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const djRef = useRef(dj);
  djRef.current = dj;
  const autoRef = useRef(autoDj);
  autoRef.current = autoDj;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const lockRef = useRef(null);
  const silentRef = useRef(null);
  const silentUrlRef = useRef(null);
  const restoredRef = useRef(false);

  const anyPlaying = dj.decks.some((deck) => deck.isPlaying) || autoDj.on;

  const setKeepAwake = useCallback((value) => {
    setKeepAwakeState(value);
    try {
      localStorage.setItem(AWAKE_KEY, value ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }, []);

  /* ---------------- Ecranul rămâne aprins cât timp cântă ---------------- */

  useEffect(() => {
    let cancelled = false;
    const release = () => {
      const lock = lockRef.current;
      lockRef.current = null;
      setWakeLockActive(false);
      try {
        lock?.release?.();
      } catch (e) {
        /* ignore */
      }
    };
    const request = async () => {
      if (cancelled || lockRef.current || !keepAwake || !anyPlaying) return;
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          try {
            lock.release?.();
          } catch (e) {
            /* ignore */
          }
          return;
        }
        lockRef.current = lock;
        setWakeLockActive(true);
        lock.addEventListener?.('release', () => {
          if (lockRef.current === lock) {
            lockRef.current = null;
            setWakeLockActive(false);
          }
        });
      } catch (e) {
        /* refuzat sau baterie critică — redarea continuă */
      }
    };

    if (anyPlaying && keepAwake) request();
    else release();

    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      release();
    };
  }, [anyPlaying, keepAwake]);

  /* -------- Sesiunea audio rămâne activă când ecranul se stinge -------- */

  useEffect(() => {
    const session = navigator.audioSession;
    if (!session || !anyPlaying) return;
    const previous = session.type;
    session.type = 'playback';
    return () => { session.type = previous; };
  }, [anyPlaying]);

  useEffect(() => {
    if (!LEGACY_IOS_KEEPER) return;
    if (!anyPlaying) {
      if (silentRef.current) silentRef.current.pause();
      return;
    }
    if (!silentRef.current) {
      silentUrlRef.current = silentWavUrl();
      const el = new Audio(silentUrlRef.current);
      el.loop = true;
      el.volume = 0.002;
      el.playsInline = true;
      el.setAttribute('playsinline', 'true');
      silentRef.current = el;
    }
    silentRef.current.play().catch(() => {});
  }, [anyPlaying]);

  useEffect(() => () => {
    silentRef.current?.pause();
    if (silentUrlRef.current) URL.revokeObjectURL(silentUrlRef.current);
  }, []);

  /* ---------------- Contextul audio revine după blocare ---------------- */

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const d = djRef.current;
      if (autoRef.current.on || d.decks.some((deck) => deck.isPlaying)) d.ensureAudio?.();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  /* -------- Reia piesa de unde a rămas, când aplicația e redeschisă -------- */

  useEffect(() => {
    if (restoredRef.current || !tracks.length) return;
    restoredRef.current = true;
    const snapshot = readSnapshot();
    if (!snapshot || !snapshot.trackId || Date.now() - (snapshot.at || 0) > RESUME_WINDOW_MS) return;
    if (dj.decks.some((deck) => deck.track)) return;
    const track = tracks.find((item) => item.id === snapshot.trackId);
    if (!track) return;
    const index = Math.max(0, Math.min(3, Number(snapshot.deck) || 0));
    (async () => {
      await dj.loadTrack(index, track);
      if (Number(snapshot.position) > 1) dj.seek(index, Number(snapshot.position));
    })();
  }, [tracks, dj]);

  useEffect(() => {
    const save = () => {
      const d = djRef.current;
      const playing = d.decks.findIndex((deck) => deck.isPlaying);
      const index = playing >= 0 ? playing : d.decks.findIndex((deck) => deck.track);
      if (index < 0) return;
      const trackId = d.decks[index]?.track?.id;
      if (!trackId) return;
      writeSnapshot({
        deck: index,
        trackId,
        position: d.getDeckAudio(index)?.currentTime || 0,
        auto: autoRef.current.on,
        at: Date.now(),
      });
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    const timer = dj.stabilityMode ? null : setInterval(save, 5000);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, [dj.stabilityMode]);

  return {
    keepAwake,
    setKeepAwake,
    wakeLockActive,
    backgroundWakeSupported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
  };
}