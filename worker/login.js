import { randomToken, sessionHash, tokenHash } from './session.js';

const LINK_MS = 10 * 60 * 1000;
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const accepted = [202, { ok: true }];
const cookie = (token, age) => `__Host-syncsonic=${token}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}`;

export async function requestLogin(env, email, address, origin, now, send = fetch) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return accepted;
  if (!env.LOGIN_EMAIL_FROM || !env.RESEND_API_KEY) return [503, { error: 'login_unavailable' }];

  const { DB: db } = env;
  const ip = await tokenHash(address || 'unknown');
  const attempt = await db.prepare(`INSERT INTO login_address_requests VALUES (?, ?, 1)
    ON CONFLICT(address_hash) DO UPDATE SET count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
    window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END RETURNING count`)
    .bind(ip, now, now - LINK_MS, now - LINK_MS).first();
  if (attempt.count > 12) return accepted;

  const quota = await db.prepare(`INSERT INTO login_email_requests VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET last_sent = excluded.last_sent WHERE last_sent <= ? RETURNING email`)
    .bind(normalized, now, now - 60000).first();
  if (!quota) return accepted;

  const user = await db.prepare("SELECT id FROM users WHERE email = ? AND role = 'user'").bind(normalized).first();
  if (!user) return accepted;
  const token = randomToken();
  const hash = await tokenHash(token);
  await db.prepare('INSERT INTO login_challenges VALUES (?, ?, ?)').bind(hash, user.id, now + LINK_MS).run();
  const link = new URL('/login', origin);
  link.hash = new URLSearchParams({ ticket: token }).toString();
  try {
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.LOGIN_EMAIL_FROM, to: [normalized], subject: 'Conectare la SyncSonic',
        text: `Deschide acest link pentru a te conecta la SyncSonic. Linkul expiră în 10 minute.\n\n${link.href}` }),
    });
    if (response.ok) return accepted;
  } catch {
    // Keep the response indistinguishable from unknown addresses.
  }
  await db.prepare('DELETE FROM login_challenges WHERE token_hash = ?').bind(hash).run();
  return accepted;
}

export async function redeemLogin(db, token, now) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return [401, { error: 'invalid_login' }];
  const used = await db.prepare(`DELETE FROM login_challenges WHERE token_hash = ? AND expires_at > ?
    AND user_id IN (SELECT id FROM users WHERE role = 'user') RETURNING user_id`).bind(await tokenHash(token), now).first();
  if (!used) return [401, { error: 'invalid_login' }];
  const session = randomToken();
  await db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await tokenHash(session), used.user_id, now + SESSION_SECONDS * 1000).run();
  return [200, { ok: true }, cookie(session, SESSION_SECONDS)];
}

export async function logout(db, request) {
  const hash = await sessionHash(request);
  if (hash) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
  return [200, { ok: true }, cookie('', 0)];
}
