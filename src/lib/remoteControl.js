import { base44 } from '@/api/base44Client';

const DEVICE_KEY = 'musicsync.remoteDeviceId';

/** Identitatea stabilă a acestui dispozitiv, folosită ca țintă a telecomenzii. */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `d${Date.now()}`).replace(/-/g, '').slice(0, 12);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (e) {
    return 'dispozitiv';
  }
}

export function getDeviceLabel() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Android/i.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone'
        : /Mac/i.test(ua) ? 'Mac'
          : /Linux/i.test(ua) ? 'Linux' : 'Dispozitiv';
  return `${os} · ${getDeviceId().slice(0, 4).toUpperCase()}`;
}

let deviceRecordId = null;
let publication = Promise.resolve();

/** Serialize device updates; heartbeats do not resend the whole library. */
export function publishDevice(tracks, state = {}, { includeTracks = true } = {}) {
  publication = publication.catch(() => {}).then(async () => {
    const deviceId = getDeviceId();
    const payload = {
      device_id: deviceId, label: getDeviceLabel(), updated_at: Date.now(),
      audio_ready: !!state.audioReady,
    };
    if (state.nowPlaying !== undefined) payload.now_playing = state.nowPlaying;
    if (state.queue !== undefined) payload.queue = state.queue.map(({ id, name }) => ({ id, name }));
    if (includeTracks || !deviceRecordId) {
      payload.tracks = tracks.map(({ id, name }) => ({ id, name }));
      payload.track_count = tracks.length;
    }
    if (!deviceRecordId) {
      const page = await base44.entities.RemoteDevice.filter({ device_id: deviceId }, { limit: 1 });
      deviceRecordId = page.items[0]?.id || null;
    }
    const record = deviceRecordId
      ? await base44.entities.RemoteDevice.update(deviceRecordId, payload)
      : await base44.entities.RemoteDevice.create(payload);
    deviceRecordId = record.id;
    return record;
  });
  return publication;
}

/** Trimite o comandă gazdei; starea este confirmată doar de gazdă. */
export function sendRemoteCommand({
  targetId, action = 'play', trackId = '', trackName = '', playAt = Date.now(),
  style = 'dj', volume,
}) {
  return base44.entities.RemoteCommand.create({
    device_id: targetId,
    action,
    track_id: trackId,
    track_name: trackName,
    play_at: playAt,
    ...(action === 'mix_now' ? { style } : {}),
    ...(action === 'volume' ? { volume } : {}),
    status: playAt > Date.now() + 1500 ? 'scheduled' : 'pending',
  });
}

/** Trimite dispozitivului țintă piesa care trebuie pornită, acum sau la o oră. */
export function sendPlayCommand({ targetId, trackId, trackName, playAt }) {
  return sendRemoteCommand({ targetId, action: 'play', trackId, trackName, playAt });
}

/** Ora din zi ca text scurt (21:45). */
export function clockText(ms) {
  return new Date(ms).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

/** Momentul de azi la ora aleasă; dacă ora a trecut, mâine. */
export function nextOccurrence(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  if (date.getTime() <= Date.now() + 5000) date.setDate(date.getDate() + 1);
  return date.getTime();
}