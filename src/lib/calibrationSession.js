import { base44 } from '@/api/base44Client';
import { workerPreview, workerRequest } from '@/api/workerClient';

export const SESSION_TTL_MS = 10 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createSessionCode() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function sessionLink(code, origin = window.location.origin) {
  return new URL(`/calibrate?c=${encodeURIComponent(code)}`, origin).href;
}

export function isSessionExpired(session) {
  return !session
    || session.status === 'expired'
    || (Number(session.expires_at) > 0 && Date.now() > Number(session.expires_at));
}

export async function createCalibrationSession({ zone, outputs }) {
  const session = {
    code: createSessionCode(),
    status: 'waiting',
    zone: zone || 'Zona principală',
    outputs: (outputs || []).map(({ deviceId, label }) => ({ deviceId, label })),
    signals: [],
    rounds: [],
    round_index: 0,
    phone_ready: false,
    capture_confirmed: false,
    expires_at: Date.now() + SESSION_TTL_MS,
  };
  return workerPreview ? workerRequest('calibration/sessions', session)
    : base44.entities.CalibrationSession.create(session);
}

export async function readCalibrationSession(code) {
  if (!code) return null;
  if (workerPreview) {
    try {
      return await readCalibrationSessionById(String(code).toUpperCase());
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }
  const page = await base44.entities.CalibrationSession.filter(
    { code: String(code).toUpperCase() },
    { sort: '-created_date', limit: 1 }
  );
  return page.items?.[0] || null;
}

export function readCalibrationSessionById(id) {
  if (workerPreview) return workerRequest('calibration/sessions/' + encodeURIComponent(id));
  return base44.entities.CalibrationSession.get(id);
}

export function updateCalibrationSession(id, patch) {
  if (workerPreview) return workerRequest('calibration/sessions/' + encodeURIComponent(id), patch, 'PATCH');
  return base44.entities.CalibrationSession.update(id, patch);
}

export function closeCalibrationSession(id) {
  return updateCalibrationSession(id, {
    status: 'cancelled',
    closed_at: Date.now(),
    phone_ready: false,
  });
}
