import { randomToken, sessionUser, tokenHash } from './session.js';

const TTL = 24 * 60 * 60 * 1000;
const mb = 1024 * 1024;
const fail = (message, status) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
const ok = (data) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
const objectKey = (id, index) => `transfers/${id}/${index}`;

function manifest(input) {
  if (!Array.isArray(input) || !input.length || input.length > 20) return null;
  if (!input.every(file => typeof file?.name === 'string' && file.name.length > 0 && file.name.length <= 240
    && !/[\\/\x00-\x1f]/.test(file.name) && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= 50 * mb
    && typeof file.type === 'string' && /^(?:audio\/[a-z0-9.+-]+|application\/octet-stream)$/i.test(file.type))) return null;
  if (input.reduce((total, file) => total + file.size, 0) > 250 * mb) return null;
  return input.map(({ name, size, type }) => ({ name, size, type }));
}

export async function cloudTransfer(request, env, action, key, now, readBody) {
  if (!env.TRANSFER_FILES) return fail('Transferul prin internet nu este configurat.', 503);
  const { DB: db, TRANSFER_FILES: bucket } = env;
  const { method } = request;
  if (method === 'GET' && (action === 'manifest' || action === 'file')) {
    const code = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!code) return fail('Cod de transfer invalid.', 400);
    const transfer = await db.prepare('SELECT id, files, expires_at FROM cloud_transfers WHERE token_hash = ? AND ready = 1 AND expires_at > ?')
      .bind(await tokenHash(code), now).first();
    if (!transfer) return fail('Codul nu există, nu este încă pregătit sau a expirat.', 404);
    const files = JSON.parse(transfer.files);
    if (action === 'manifest' && !key) return ok({ id: transfer.id, files, expires_at: transfer.expires_at });
    if (action !== 'file' || !/^\d{1,2}$/.test(key ?? '') || !files[Number(key)]) return fail('Piesa nu a fost găsită.', 404);
    const object = await bucket.get(objectKey(transfer.id, Number(key)));
    if (!object) return fail('Piesa nu mai este disponibilă.', 404);
    return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream',
      'Content-Length': String(object.size), 'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  }

  const user = await sessionUser(request, db, now);
  if (!user) return fail('Conectează-te pentru a încărca piese.', 401);
  if (method === 'POST' && action === 'create' && !key) {
    const files = manifest((await readBody(request))?.files);
    if (!files) return fail('Poți încărca până la 20 de piese, 50 MB per piesă și 250 MB în total.', 400);
    const code = randomToken();
    const id = crypto.randomUUID();
    await db.prepare('DELETE FROM cloud_transfers WHERE owner_id = ? AND expires_at <= ?').bind(user.id, now).run();
    const created = await db.prepare(`INSERT INTO cloud_transfers
      SELECT ?, ?, ?, ?, ?, 0 WHERE (SELECT count(*) FROM cloud_transfers WHERE owner_id = ?) < 3
      RETURNING id`).bind(id, user.id, await tokenHash(code), JSON.stringify(files), now + TTL, user.id).first();
    if (!created) return fail('Ai atins limita de trei transferuri în 24 de ore.', 429);
    return ok({ id: created.id, code });
  }
  if (!key || !/^[a-f0-9-]{36}$/.test(key)) return fail('Transferul nu a fost găsit.', 404);
  const transfer = await db.prepare('SELECT files FROM cloud_transfers WHERE id = ? AND owner_id = ? AND ready = 0 AND expires_at > ?')
    .bind(key, user.id, now).first();
  if (!transfer) return fail('Transferul nu mai poate fi modificat.', 404);
  const files = JSON.parse(transfer.files);
  if (method === 'PUT' && action === 'upload') {
    const index = new URL(request.url).searchParams.get('index');
    const file = /^\d{1,2}$/.test(index ?? '') ? files[Number(index)] : null;
    if (!file || !request.body || request.headers.get('Content-Length') !== String(file.size)) {
      return fail('Dimensiunea încărcării nu corespunde.', 400);
    }
    const object = await bucket.put(objectKey(key, Number(index)), request.body, { onlyIf: { etagDoesNotMatch: '*' } });
    if (!object && (await bucket.head(objectKey(key, Number(index))))?.size !== file.size) return fail('Piesa nu a putut fi încărcată.', 409);
    return ok({ ok: true });
  }
  if (method === 'POST' && action === 'finish') {
    const uploaded = await Promise.all(files.map((_, index) => bucket.head(objectKey(key, index))));
    if (!uploaded.every((object, index) => object?.size === files[index].size)) return fail('Mai sunt piese de încărcat.', 409);
    await db.prepare('UPDATE cloud_transfers SET ready = 1 WHERE id = ? AND owner_id = ?').bind(key, user.id).run();
    return ok({ ok: true });
  }
  return fail('Transferul nu a fost găsit.', 404);
}
