import { createRemoteJWKSet, jwtVerify } from 'jose';
import { issueSession, logout } from './login.js';

const teamPattern = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/;
let keyOrigin;
let keys;

export async function adminSignIn(request, env, now) {
  const issuer = env.ADMIN_ACCESS_ISSUER;
  const audience = env.ADMIN_ACCESS_AUDIENCE;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!teamPattern.test(issuer ?? '') || typeof audience !== 'string' || !audience) {
    return [503, { error: 'admin_access_unavailable' }];
  }
  if (!token) return [401, { error: 'admin_authentication_required' }];

  if (keyOrigin !== issuer) {
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
    keyOrigin = issuer;
  }
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, keys, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'sub', 'email'],
    }));
  } catch {
    return [401, { error: 'invalid_admin_identity' }];
  }
  if (typeof claims.email !== 'string') return [401, { error: 'invalid_admin_identity' }];
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND role = 'admin'")
    .bind(claims.email.trim().toLowerCase()).first();
  if (!user) return [403, { error: 'admin_access_denied' }];

  const seconds = Math.min(900, Math.floor(claims.exp - now / 1000));
  if (seconds <= 0) return [401, { error: 'invalid_admin_identity' }];
  await logout(env.DB, request);
  return issueSession(env.DB, user.id, now, seconds);
}
