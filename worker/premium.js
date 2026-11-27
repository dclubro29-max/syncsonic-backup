const LIFETIME = '9999-12-31';
const CAMPAIGN = 'syncsonic-box-demo-ro';
const dateFormat = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'long', timeZone: 'UTC' });
const bucharest = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });

function localDate(now) {
  const parts = Object.fromEntries(bucharest.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function expiresLabel(date, lifetime) {
  return lifetime ? 'Pe viață' : dateFormat.format(new Date(`${date}T12:00:00Z`));
}

function activation(row) {
  return { ...row, id: row.code_id, lifetime: Boolean(row.lifetime), first_in_campaign: Boolean(row.first_in_campaign),
    months_label: row.lifetime ? 'Pe viață' : row.months === 1 ? '1 lună' : `${row.months} luni`,
    expires_on_display: expiresLabel(row.expires_on, row.lifetime), created_date: new Date(row.created_at).toISOString() };
}

export async function premiumCodeHash(code, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, enc.encode(code));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function premiumAccount(db, userId, now) {
  const today = localDate(now);
  const campaign = await db.prepare('SELECT * FROM premium_campaigns WHERE slug = ?').bind(CAMPAIGN).first();
  if (!campaign) return { campaign: null, entitlement: null, history: [], active: false, today };
  const [entitlement, history] = await Promise.all([
    db.prepare('SELECT * FROM premium_entitlements WHERE user_id = ? AND campaign_id = ?').bind(userId, campaign.id).first(),
    db.prepare(`SELECT * FROM premium_activations WHERE user_id = ? AND campaign_id = ?
      ORDER BY created_at DESC LIMIT 20`).bind(userId, campaign.id).all(),
  ]);
  const { details, ...fields } = campaign;
  const lifetime = Boolean(entitlement?.lifetime);
  const active = lifetime || Boolean(entitlement && entitlement.expires_on >= today);
  return { campaign: { ...JSON.parse(details), ...fields }, entitlement: entitlement && {
    ...entitlement, active, lifetime, expires_on_display: expiresLabel(entitlement.expires_on, lifetime),
  }, active, lifetime, today, history: history.results.map(activation) };
}

export async function redeemPremium(db, userId, rawCode, secret, now) {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase().replace(/\s/g, '') : '';
  if (!/^[A-Z0-9]{6}$/.test(code)) return [400, { error: 'Codul are exact șase litere sau cifre.', code: 'invalid_format' }];
  if (typeof secret !== 'string' || secret.length < 32) return [503, { error: 'Activarea Premium nu este disponibilă.' }];
  const attempts = await db.prepare(`INSERT INTO premium_attempts (user_id, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT (user_id) DO UPDATE SET count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END RETURNING count`)
    .bind(userId, now, now - 600000, now - 600000).first();
  if (attempts.count > 8) return [429, { error: 'Prea multe încercări. Încearcă mai târziu.', code: 'rate_limited' }];
  const digest = await premiumCodeHash(code, secret);
  const today = localDate(now);

  // The unique code ID and the entitlement trigger commit in the same SQLite statement.
  const granted = await db.prepare(`
    WITH eligible AS (
      SELECT c.id, c.campaign_id, c.code_masked, c.lifetime,
        coalesce(e.activation_count, 0) = 0 AS first_grant,
        CASE WHEN c.lifetime THEN 0 WHEN coalesce(e.activation_count, 0) = 0 THEN p.first_months
          ELSE p.additional_months END AS months,
        CASE WHEN NOT c.lifetime AND e.expires_on >= ? THEN date(e.expires_on, '+1 day') ELSE ? END AS start_date
      FROM premium_codes c JOIN premium_campaigns p ON p.id = c.campaign_id
      LEFT JOIN premium_entitlements e ON e.user_id = ? AND e.campaign_id = c.campaign_id
      WHERE c.code_hash = ? AND p.slug = ? AND NOT c.disabled AND (c.lifetime OR NOT coalesce(e.lifetime, 0))
    ), dates AS (
      SELECT *, date(start_date, 'start of month', '+' || months || ' months') AS month_start FROM eligible
    )
    INSERT INTO premium_activations (code_id, user_id, campaign_id, code_masked, months, lifetime,
      first_in_campaign, granted_from, expires_on, created_at)
    SELECT id, ?, campaign_id, code_masked, months, lifetime, first_grant, start_date,
      CASE WHEN lifetime THEN '9999-12-31' ELSE date(month_start,
        '+' || (min(CAST(strftime('%d', start_date) AS INTEGER),
          CAST(strftime('%d', date(month_start, '+1 month', '-1 day')) AS INTEGER)) - 1) || ' days') END, ?
    FROM dates WHERE true ON CONFLICT(code_id) DO NOTHING RETURNING *
  `).bind(today, today, userId, digest, CAMPAIGN, userId, now).first();
  if (granted) return [200, { ok: true, ...activation(granted) }];

  const existing = await db.prepare(`SELECT c.disabled, c.lifetime AS code_lifetime, a.*, e.lifetime AS user_lifetime
    FROM premium_codes c JOIN premium_campaigns p ON p.id = c.campaign_id
    LEFT JOIN premium_activations a ON a.code_id = c.id
    LEFT JOIN premium_entitlements e ON e.user_id = ? AND e.campaign_id = c.campaign_id
    WHERE c.code_hash = ? AND p.slug = ?`).bind(userId, digest, CAMPAIGN).first();
  if (!existing) return [404, { error: 'Codul nu a fost găsit.', code: 'not_found' }];
  if (existing.user_id === userId) return [200, { ok: true, ...activation(existing), idempotent: true }];
  if (existing.user_lifetime && !existing.code_lifetime) return [200, { ok: true, lifetime: true, already_lifetime: true,
    months: 0, months_label: 'Pe viață', expires_on: LIFETIME, expires_on_display: 'Pe viață' }];
  if (existing.disabled) return [410, { error: 'Codul nu mai este disponibil.', code: 'disabled' }];
  return [409, { error: 'Codul a fost deja activat.', code: 'already_used' }];
}
