import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from './index.js';

const origin = 'https://syncsonic.example';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./migrations/0001_accounts_and_sessions.sql', import.meta.url), 'utf8'));
  const DB = { prepare(query) {
    const statement = sql.prepare(query);
    return { bind(...values) {
      return { first: async () => statement.get(...values), all: async () => ({ results: statement.all(...values) }) };
    } };
  } };
  for (const name of ['a', 'b', 'expired']) {
    sql.prepare('INSERT INTO users(id, email) VALUES (?, ?)').run(name, `${name}@example.test`);
    sql.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
      createHash('sha256').update(name[0].repeat(43)).digest('hex'), name, Date.now() + (name === 'expired' ? -60000 : 60000),
    );
  }
  const send = (path, { user = 'a', method = 'GET', data, requestOrigin = origin } = {}) => worker.fetch(new Request(origin + '/api/v1/' + path, {
    method, headers: { 'content-type': 'application/json', Origin: requestOrigin,
      ...(user ? { cookie: `__Host-syncsonic=${user[0].repeat(43)}` } : {}) }, body: data ? JSON.stringify(data) : undefined,
  }), { DB });
  return { send, sql };
}

test('session endpoint rejects anonymous and expired sessions', async () => {
  const { send, sql } = fixture();
  try {
    assert.equal((await send('account/session', { user: null })).status, 401);
    assert.equal((await send('account/session', { user: 'expired' })).status, 401);
    const response = await send('account/session');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, 'a');
  } finally { sql.close(); }
});

test('remote commands are account-scoped and terminal commands stay terminal', async () => {
  const { send, sql } = fixture();
  try {
    const device = { label: 'Player', audio_ready: true, tracks: [{ id: 'demo', name: 'Demo' }] };
    assert.equal((await send('remote/devices/player', { method: 'PUT', data: device, requestOrigin: 'https://other.example' })).status, 403);
    assert.equal((await send('remote/devices/player', { method: 'PUT', data: device })).status, 200);
    const heartbeat = await send('remote/devices/player', { method: 'PUT', data: { label: 'Player', audio_ready: true } });
    assert.deepEqual((await heartbeat.json()).tracks, device.tracks);
    assert.deepEqual((await (await send('remote/devices', { user: 'b' })).json()).items, []);
    const data = { device_id: 'player', action: 'volume', volume: 0.25, play_at: Date.now() };
    assert.equal((await send('remote/commands', { method: 'POST', data, user: 'b' })).status, 404);
    const command = await send('remote/commands', { method: 'POST', data });
    assert.equal(command.status, 201);
    const { id } = await command.json();
    const done = { method: 'PATCH', data: { status: 'done' } };
    assert.equal((await send(`remote/commands/${id}`, { ...done, user: 'b' })).status, 404);
    assert.equal((await send(`remote/commands/${id}`, done)).status, 200);
    assert.equal((await send(`remote/commands/${id}`, { ...done, data: { status: 'mixing' } })).status, 404);
  } finally { sql.close(); }
});

test('calibration data is private, expires, and cannot be reopened after closure', async () => {
  const { send, sql } = fixture();
  try {
    const code = 'ABCD2345';
    const created = await send('calibration/sessions', { method: 'POST', data: { code, outputs: [] } });
    assert.equal(created.status, 201);
    const { id, expires_at } = await created.json();
    assert.equal((await send(`calibration/sessions/${code}`, { user: 'b' })).status, 404);
    const route = `calibration/sessions/${id}`;
    const updated = await send(route, { method: 'PATCH', data: { phone_ready: true, expires_at: 1 } });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).expires_at, expires_at);
    assert.equal((await send(route, { method: 'PATCH', data: { status: 'cancelled' } })).status, 200);
    assert.equal((await send(route, { method: 'PATCH', data: { status: 'measuring' } })).status, 404);
    sql.prepare('UPDATE calibration_sessions SET expires_at = 0 WHERE id = ?').run(id);
    assert.equal((await send(route)).status, 404);
  } finally { sql.close(); }
});
