import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from './index.js';
import { premiumAccount, premiumCodeHash, redeemPremium } from './premium.js';
import { requestLogin } from './login.js';
import { importSnapshot } from './import-snapshot.js';

const origin = 'https://syncsonic.example';

test('snapshot import preserves rights, masks codes, rejects retries and rolls back inconsistent data', async () => {
  const sql = new DatabaseSync(':memory:');
  const key = 'synthetic-key-for-snapshot-import-tests';
  const expires_on = '9999-12-31';
  const snapshot = {
    users: [{ id: 'user', email: 'user@example.test', role: 'user' }],
    campaigns: [{ id: 'campaign', slug: 'syncsonic-box-demo-ro', name: 'Test campaign' }],
    codes: [{ id: 'code', campaign_id: 'campaign', code: 'ABC123', status: 'claimed', lifetime: true }],
    activations: [{ code_id: 'code', user_id: 'user', campaign_id: 'campaign', months: 0,
      created_date: '2026-10-10T12:30:00.000Z', expires_on, lifetime: true, first_in_campaign: true }],
    entitlements: [{ user_id: 'user', campaign_id: 'campaign', expires_on, lifetime: true, activation_count: 1 }],
  };
  try {
    for (const file of ['0001_accounts_and_sessions.sql', '0002_premium.sql']) {
      sql.exec(readFileSync(new URL('./migrations/' + file, import.meta.url), 'utf8'));
    }
    await assert.rejects(importSnapshot(sql, { ...snapshot, entitlements: [] }, key), /counts/);
    assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0);
    const counts = await importSnapshot(sql, snapshot, key);
    assert.deepEqual(Object.values(counts), [1, 1, 1, 1, 1]);
    const code = sql.prepare('SELECT * FROM premium_codes').get();
    assert.equal(code.code_hash, await premiumCodeHash('ABC123', key));
    assert.equal(code.code_masked, '••••23');
    assert.equal(code.disabled, 1);
    assert.deepEqual({ ...sql.prepare('SELECT lifetime, expires_on, activation_count FROM premium_entitlements').get() },
      { lifetime: 1, expires_on, activation_count: 1 });
    await assert.rejects(importSnapshot(sql, snapshot, key), /not empty/);
  } finally { sql.close(); }
});

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('./migrations/0001_accounts_and_sessions.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('./migrations/0002_premium.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('./migrations/0003_login_challenges.sql', import.meta.url), 'utf8'));
  const DB = { prepare(query) {
    const statement = sql.prepare(query);
    return { bind(...values) {
      return { first: async () => statement.get(...values), all: async () => ({ results: statement.all(...values) }),
        run: async () => statement.run(...values) };
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
  return { send, sql, DB };
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

test('verified email grants an expiring, single-use login and logout revokes the session', async () => {
  const { DB, sql, send } = fixture();
  const now = Date.now();
  const env = { DB, LOGIN_EMAIL_FROM: 'test@example.test', RESEND_API_KEY: 'synthetic-test-value' };
  const sent = [];
  const deliver = async (_url, options) => { sent.push(JSON.parse(options.body)); return new Response(null, { status: 200 }); };
  const request = email => requestLogin(env, email, 'test-address', origin, now, deliver, '/activate');
  try {
    sql.prepare("UPDATE users SET role = 'admin' WHERE id = 'b'").run();
    assert.deepEqual(await request('unknown@example.test'), await request('b@example.test'));
    assert.equal(sent.length, 0);
    assert.equal((await request('A@example.test'))[0], 202);
    await request('a@example.test');
    assert.equal(sent.length, 1);
    const link = new URL(sent[0].text.trim().split('\n').at(-1));
    const ticket = new URLSearchParams(link.hash.slice(1)).get('ticket');
    assert.equal(link.searchParams.get('returnTo'), '/activate');
    assert.equal(sql.prepare('SELECT token_hash FROM login_challenges').get().token_hash.length, 64);
    const confirm = { user: null, method: 'POST', data: { ticket } };
    assert.equal((await send('account/login-confirm', { ...confirm, requestOrigin: 'https://other.example' })).status, 403);
    const results = await Promise.all([send('account/login-confirm', confirm), send('account/login-confirm', confirm)]);
    assert.deepEqual(results.map(response => response.status).sort(), [200, 401]);
    const setCookie = results.find(response => response.ok).headers.get('set-cookie');
    assert.match(setCookie, /Secure; HttpOnly; SameSite=Lax/);
    const rawCookie = setCookie.split(';')[0];
    const authorized = (path, method = 'GET') => worker.fetch(new Request(`${origin}/api/v1/account/${path}`, {
      method, headers: { cookie: rawCookie, Origin: origin },
    }), env);
    assert.equal((await authorized('session')).status, 200);
    assert.equal((await authorized('logout', 'POST')).status, 200);
    assert.equal((await authorized('session')).status, 401);
  } finally { sql.close(); }
});

test('Premium claims are atomic and preserve calendar terms and lifetime access', async () => {
  const { DB, sql } = fixture();
  const key = 'synthetic-premium-key-used-only-in-tests';
  const now = Date.UTC(2026, 0, 31, 12);
  try {
    sql.prepare(`INSERT INTO premium_campaigns(id,slug,name,first_months,additional_months)
      VALUES ('test', 'syncsonic-box-demo-ro', 'Test', 3, 1)`).run();
    for (const [code, lifetime] of [['FIRST1', 0], ['NEXT02', 0], ['LIFE03', 1], ['LAST04', 0]]) {
      sql.prepare(`INSERT INTO premium_codes(id,campaign_id,code_hash,code_masked,lifetime)
        VALUES (?, 'test', ?, ?, ?)`).run(code, await premiumCodeHash(code, key), code.slice(0, 2) + '••' + code.slice(-2), lifetime);
    }
    const claims = await Promise.all(['a', 'b'].map(user => redeemPremium(DB, user, 'FIRST1', key, now)));
    assert.deepEqual(claims.map(([status]) => status).sort(), [200,409]);
    const winner = claims[0][0] === 200 ? 'a' : 'b';
    const first = claims.find(([status]) => status === 200)[1];
    assert.equal(first.expires_on, '2026-04-30');
    assert.equal((await redeemPremium(DB, winner, 'FIRST1', key, now))[1].idempotent, true);
    const [, next] = await redeemPremium(DB, winner, 'NEXT02', key, now);
    assert.equal(next.months, 1);
    assert.equal(next.granted_from, '2026-05-01');
    assert.equal(next.expires_on, '2026-06-01');
    assert.equal((await redeemPremium(DB, winner, 'LIFE03', key, now))[1].lifetime, true);
    assert.equal((await redeemPremium(DB, winner, 'LAST04', key, now))[1].already_lifetime, true);
    const account = await premiumAccount(DB, winner, now);
    assert.equal(account.entitlement.activation_count, 3);
    assert.equal(account.entitlement.expires_on, '9999-12-31');
    assert.equal(account.history.length, 3);
    assert.equal(sql.prepare('SELECT count(*) AS count FROM premium_activations').get().count, 3);
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
