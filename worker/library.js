const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;
const roles = new Set(['sender', 'receiver']);
const ttl = 180000;

export async function libraryPair(request, db, userId, id, now, body) {
  const method = request.method;
  if (method === 'GET' && !id) {
    const params = new URL(request.url).searchParams;
    const code = params.get('code');
    const role = params.get('role');
    if (!codePattern.test(code ?? '') || !roles.has(role)) return [400, { error: 'invalid_pair' }];
    const row = await db.prepare(`SELECT id, payload FROM library_pairs
      WHERE user_id = ? AND code = ? AND role = ? AND expires_at > ?`).bind(userId, code, role, now).first();
    return [200, { items: row ? [{ ...JSON.parse(row.payload), id: row.id, code, role }] : [] }];
  }
  if (method === 'DELETE' && id) {
    await db.prepare('DELETE FROM library_pairs WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return [200, { ok: true }];
  }
  if (method === 'PATCH' && id) {
    const data = await body(request);
    if (!validSdp(data?.offer, 'offer')) return [400, { error: 'invalid_offer' }];
    const row = await db.prepare(`UPDATE library_pairs SET payload = json_patch(payload, ?)
      WHERE id = ? AND user_id = ? AND role = 'sender' AND expires_at > ? RETURNING id`)
      .bind(JSON.stringify({ offer: data.offer, status: 'connecting' }), id, userId, now).first();
    return row ? [200, row] : [404, { error: 'pair_not_found' }];
  }
  if (method === 'POST' && !id) {
    const data = await body(request);
    if (!codePattern.test(data?.code ?? '') || !roles.has(data?.role)) return [400, { error: 'invalid_pair' }];
    const { code, role } = data;
    let payload;
    if (role === 'sender') {
      if (!validCount(data.track_count) || !validCount(data.total_size)) return [400, { error: 'invalid_track_count' }];
      payload = { status: 'waiting', track_count: data.track_count, total_size: data.total_size };
    } else {
      if (!validSdp(data.answer, 'answer')) return [400, { error: 'invalid_answer' }];
      const sender = await db.prepare(`SELECT id FROM library_pairs
        WHERE user_id = ? AND code = ? AND role = 'sender' AND expires_at > ?
          AND json_extract(payload, '$.offer') IS NOT NULL`).bind(userId, code, now).first();
      if (!sender) return [404, { error: 'pair_not_found' }];
      payload = { status: 'connecting', answer: data.answer };
    }
    await db.prepare('DELETE FROM library_pairs WHERE user_id = ? AND expires_at <= ?').bind(userId, now).run();
    const row = await db.prepare(`INSERT INTO library_pairs VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, code, role) DO NOTHING RETURNING id`)
      .bind(crypto.randomUUID(), userId, code, role, JSON.stringify(payload), now + ttl).first();
    return row ? [201, { ...payload, id: row.id, code, role }] : [409, { error: 'pair_already_exists' }];
  }
  return [404, { error: 'not_found' }];
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validSdp(value, type) {
  if (typeof value !== 'string' || value.length > 65536) return false;
  try {
    const parsed = JSON.parse(value);
    return parsed?.type === type && typeof parsed.sdp === 'string' && parsed.sdp.startsWith('v=0');
  } catch {
    return false;
  }
}
