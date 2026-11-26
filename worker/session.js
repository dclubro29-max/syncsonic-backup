const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sessionHash(request) {
  const cookies = request.headers.get('cookie')?.split(';') ?? [];
  const session = cookies.map(cookie => cookie.trim()).find(cookie => cookie.startsWith('__Host-syncsonic='));
  const token = session?.slice('__Host-syncsonic='.length);
  return tokenPattern.test(token ?? '') ? tokenHash(token) : null;
}

export async function sessionUser(request, db, now) {
  const hash = await sessionHash(request);
  if (!hash) return null;
  return db.prepare(`
    SELECT users.id, users.email, users.role, users.skin FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ?
  `).bind(hash, now).first();
}
