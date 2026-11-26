import { parseTrackName } from '@/lib/trackName';

export function mediaSessionAvailable() {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator &&
    typeof window !== 'undefined' && 'MediaMetadata' in window;
}

/** Lock screen / notification shade: what the phone shows while the set runs. */
export function setSessionMetadata(track) {
  if (!mediaSessionAvailable() || !track) return;
  const { artist, title } = parseTrackName(track.name || '');
  const art = track.cover || track.art || null;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'SyncSonic',
      artist: artist || 'SyncSonic',
      album: 'SyncSonic · set live',
      artwork: art ? [{ src: art, sizes: '512x512' }] : [],
    });
  } catch (e) {
    /* ignore */
  }
}

export function setSessionPlaybackState(state) {
  if (!mediaSessionAvailable()) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch (e) {
    /* ignore */
  }
}

export function setSessionPosition(position, duration, rate = 1) {
  if (!mediaSessionAvailable() || !navigator.mediaSession.setPositionState) return;
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.max(0, Math.min(duration, position)),
      playbackRate: Math.max(0.5, Math.min(2, rate || 1)),
    });
  } catch (e) {
    /* ignore */
  }
}

/** Phone buttons: play/pause, next, seek. Returns the cleanup for the handlers. */
export function bindSessionActions(handlers) {
  if (!mediaSessionAvailable()) return () => {};
  const entries = Object.entries(handlers || {});
  entries.forEach(([action, fn]) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn ? () => fn() : null);
    } catch (e) {
      /* browser does not know this action */
    }
  });
  return () => {
    entries.forEach(([action]) => {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch (e) {
        /* ignore */
      }
    });
  };
}