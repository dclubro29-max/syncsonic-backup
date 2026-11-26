import { sessionUser } from './session.js';
import { premiumAccount, redeemPremium } from './premium.js';
import { logout, redeemLogin, requestLogin } from './login.js';

const devicePattern = /^[A-Za-z0-9_-]{1,64}$/;
const calibrationPattern = /^[A-Z2-9]{8}$/;
const actions = new Set(['play', 'mix_now', 'queue', 'toggle', 'next', 'volume']);
const terminal = new Set(['done', 'cancelled', 'expired']);
const calibrationStates = new Set(['waiting', 'capturing', 'measuring', ...terminal]);
const calibrationFields = new Set(['status', 'signals', 'round_index', 'phone_ready', 'capture_confirmed',
  'capture_started_at', 'rounds', 'result', 'closed_at']);
const MAX_BODY = 192 * 1024;

function json(value, status = 200, cookie) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}

async function body(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function record(row, fields) {
  return { ...JSON.parse(row.payload), ...fields };
}

async function remote(request, db, userId, resource, key, now) {
  if (resource === 'devices' && request.method === 'GET' && !key) {
    const { results } = await db.prepare(`
      SELECT device_id, payload, updated_at FROM remote_devices
      WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at DESC LIMIT 100
    `).bind(userId, now - 120000).all();
    return json({ items: results.map(row => record(row, { device_id: row.device_id, updated_at: row.updated_at })) });
  }

  if (resource === 'devices' && request.method === 'PUT' && devicePattern.test(key ?? '')) {
    const data = await body(request);
    if (!data || typeof data.label !== 'string' || data.label.length > 128 || typeof data.audio_ready !== 'boolean') {
      return json({ error: 'invalid_device' }, 400);
    }
    const payload = JSON.stringify({ label: data.label, audio_ready: data.audio_ready,
      tracks: data.tracks, track_count: data.track_count, now_playing: data.now_playing, queue: data.queue });
    const row = await db.prepare(`
      INSERT INTO remote_devices (user_id, device_id, payload, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, device_id) DO UPDATE SET
        payload = json_patch(remote_devices.payload, excluded.payload), updated_at = excluded.updated_at
      RETURNING payload
    `).bind(userId, key, payload, now).first();
    return json(record(row, { device_id: key, updated_at: now }));
  }

  if (resource === 'commands' && request.method === 'GET' && devicePattern.test(key ?? '')) {
    const { results } = await db.prepare(`
      SELECT id, payload, play_at, created_at FROM remote_commands
      WHERE user_id = ? AND device_id = ? AND play_at >= ? ORDER BY play_at, created_at LIMIT 100
    `).bind(userId, key, now - 120000).all();
    return json({ items: results.map(row => record(row, { id: row.id, device_id: key,
      play_at: row.play_at, created_date: new Date(row.created_at).toISOString() })) });
  }

  if (resource === 'commands' && request.method === 'POST' && !key) {
    const data = await body(request);
    if (!data || !devicePattern.test(data.device_id ?? '') || !actions.has(data.action)
      || !Number.isSafeInteger(data.play_at) || data.play_at < now - 120000 || data.play_at > now + 86400000
      || (data.action === 'volume' && (!Number.isFinite(data.volume) || data.volume < 0 || data.volume > 1))) {
      return json({ error: 'invalid_command' }, 400);
    }
    const id = crypto.randomUUID();
    const command = { action: data.action, track_id: data.track_id, track_name: data.track_name,
      style: data.style, volume: data.volume, status: data.play_at > now + 1500 ? 'scheduled' : 'pending' };
    const row = await db.prepare(`
      INSERT INTO remote_commands (id, user_id, device_id, payload, play_at, created_at)
      SELECT ?, user_id, device_id, ?, ?, ? FROM remote_devices WHERE user_id = ? AND device_id = ?
      RETURNING id
    `).bind(id, JSON.stringify(command), data.play_at, now, userId, data.device_id).first();
    return row ? json({ ...command, id, device_id: data.device_id, play_at: data.play_at }, 201)
      : json({ error: 'device_not_found' }, 404);
  }

  if (resource === 'commands' && request.method === 'PATCH' && devicePattern.test(key ?? '')) {
    const data = await body(request);
    if (!data || !['preparing', 'mixing', 'done', 'skipped', 'failed'].includes(data.status)) {
      return json({ error: 'invalid_status' }, 400);
    }
    const patch = JSON.stringify({ status: data.status, done_at: data.done_at, error_message: data.error_message });
    const row = await db.prepare(`
      UPDATE remote_commands SET payload = json_patch(payload, ?) WHERE id = ? AND user_id = ?
        AND json_extract(payload, '$.status') NOT IN ('done', 'skipped', 'failed')
      RETURNING payload
    `).bind(patch, key, userId).first();
    return row ? json(record(row, { id: key })) : json({ error: 'command_unavailable' }, 404);
  }

  return json({ error: 'not_found' }, 404);
}

async function calibration(request, db, userId, key, now) {
  if (request.method === 'GET' && key) {
    const row = await db.prepare(`
      SELECT id, code, payload, expires_at FROM calibration_sessions
      WHERE user_id = ? AND expires_at > ? AND (code = ? OR id = ?) LIMIT 1
    `).bind(userId, now, key, key).first();
    return row ? json(record(row, { id: row.id, code: row.code, expires_at: row.expires_at }))
      : json({ error: 'session_not_found' }, 404);
  }
  if (request.method === 'POST' && !key) {
    const data = await body(request);
    if (!data || !calibrationPattern.test(data.code ?? '') || !Array.isArray(data.outputs) || data.outputs.length > 32) {
      return json({ error: 'invalid_calibration' }, 400);
    }
    const id = crypto.randomUUID();
    const expires = now + 600000;
    const payload = { outputs: data.outputs, zone: data.zone, status: 'waiting', signals: [], rounds: [],
      round_index: 0, phone_ready: false, capture_confirmed: false };
    const row = await db.prepare(`
      INSERT INTO calibration_sessions (id, user_id, code, payload, expires_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, code) DO NOTHING RETURNING id
    `).bind(id, userId, data.code, JSON.stringify(payload), expires).first();
    return row ? json({ ...payload, id, code: data.code, expires_at: expires }, 201)
      : json({ error: 'code_conflict' }, 409);
  }
  if (request.method === 'PATCH' && key) {
    const data = await body(request);
    if (!data || (data.status !== undefined && !calibrationStates.has(data.status))) {
      return json({ error: 'invalid_calibration' }, 400);
    }
    const patch = JSON.stringify(Object.fromEntries(Object.entries(data).filter(([name]) => calibrationFields.has(name))));
    const row = await db.prepare(`
      UPDATE calibration_sessions SET payload = json_patch(payload, ?)
      WHERE id = ? AND user_id = ? AND expires_at > ?
        AND json_extract(payload, '$.status') NOT IN ('done', 'cancelled', 'expired')
      RETURNING code, payload, expires_at
    `).bind(patch, key, userId, now).first();
    return row ? json(record(row, { id: key, code: row.code, expires_at: row.expires_at }))
      : json({ error: 'session_unavailable' }, 404);
  }
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!['GET', 'POST', 'PUT', 'PATCH'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405);
    if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) {
      return json({ error: 'invalid_origin' }, 403);
    }
    const now = Date.now();
    const [, , version, area, resource, key, extra] = url.pathname.split('/');
    if (version !== 'v1' || extra) return json({ error: 'not_found' }, 404);
    if (area === 'account' && !key && request.method === 'POST') {
      let reply;
      if (resource === 'login-request') {
        const data = await body(request);
        reply = await requestLogin(env, data?.email, request.headers.get('CF-Connecting-IP'), url.origin, now);
      } else if (resource === 'login-confirm') {
        const data = await body(request);
        reply = await redeemLogin(env.DB, data?.ticket, now);
      } else if (resource === 'logout') reply = await logout(env.DB, request);
      if (reply) return json(reply[1], reply[0], reply[2]);
    }
    const user = await sessionUser(request, env.DB, now);
    if (!user) return json({ error: 'authentication_required' }, 401);
    if (area === 'account' && resource === 'session' && !key && request.method === 'GET') return json(user);
    if (area === 'premium' && resource === 'account' && !key && request.method === 'GET') {
      return json(await premiumAccount(env.DB, user.id, now));
    }
    if (area === 'premium' && resource === 'redeem' && !key && request.method === 'POST') {
      const data = await body(request);
      const [status, response] = await redeemPremium(env.DB, user.id, data?.code, env.PREMIUM_CODE_KEY, now);
      return json(response, status);
    }
    if (area === 'remote') return remote(request, env.DB, user.id, resource, key, now);
    if (area === 'calibration' && resource === 'sessions') return calibration(request, env.DB, user.id, key, now);
    return json({ error: 'not_found' }, 404);
  },
};
