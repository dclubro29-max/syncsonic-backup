const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function sessionUser(request, db, now) {
  const cookies = request.headers.get('cookie')?.split(';') ?? [];
  const session = cookies.map(cookie => cookie.trim()).find(cookie => cookie.startsWith('__Host-syncsonic='));
  const token = session?.slice('__Host-syncsonic='.length);
  if (!tokenPattern.test(token ?? '')) return null;

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return db.prepare(`
    SELECT users.id, users.email, users.role, users.skin FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ?
  `).bind(hash, now).first();
}
