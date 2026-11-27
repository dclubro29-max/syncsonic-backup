import { randomToken, sessionUser, tokenHash } from './session.js';

const TTL = 24 * 60 * 60 * 1000;
const mb = 1024 * 1024;
const fail = (message, status) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
const ok = (data) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
const objectKey = (id, index) => `transfers/${id}/${index}`;

function manifest(input, maxFile, maxTotal) {
  if (!Array.isArray(input) || !input.length || input.length > 20) return null;
  if (!input.every(file => typeof file?.name === 'string' && file.name.length > 0 && file.name.length <= 240
    && !/[\\/\x00-\x1f]/.test(file.name) && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= maxFile * mb
    && typeof file.type === 'string' && /^(?:audio\/[a-z0-9.+-]+|application\/octet-stream)$/i.test(file.type))) return null;
  if (input.reduce((total, file) => total + file.size, 0) > maxTotal * mb) return null;
  return input.map(({ name, size, type }) => ({ name, size, type }));
}

export async function cloudTransfer(request, env, action, key, now, readBody) {
  const { DB: db, TRANSFER_FILES: bucket, TRANSFER_KV: kv } = env;
  if (!bucket && !kv) return fail('Transferul prin internet nu este configurat.', 503);
  const useKV = !bucket;
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
    const index = Number(key);
    const name = objectKey(transfer.id, index);
    const object = useKV
      ? { body: await kv.get(name, 'stream'), size: files[index].size }
      : await bucket.get(name);
    if (useKV && !object.body) return fail('Piesa nu a ajuns încă în regiunea ta. Reîncearcă într-un minut.', 503);
    if (!object) return fail('Piesa nu mai este disponibilă.', 404);
    return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream',
      'Content-Length': String(object.size), 'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  }

  const user = await sessionUser(request, db, now);
  if (!user) return fail('Conectează-te pentru a încărca piese.', 401);
  if (method === 'POST' && action === 'create' && !key) {
    const [maxFile, maxTotal] = useKV ? [20, 100] : [50, 250];
    const files = manifest((await readBody(request))?.files, maxFile, maxTotal);
    if (!files) return fail(`Poți încărca până la 20 de piese, ${maxFile} MB per piesă și ${maxTotal} MB în total.`, 400);
    const code = randomToken();
    const id = crypto.randomUUID();
    await db.prepare('DELETE FROM cloud_transfers WHERE expires_at <= ?').bind(now).run();
    const available = useKV ? 500 * mb - files.reduce((sum, file) => sum + file.size, 0) : Number.MAX_SAFE_INTEGER;
    const created = await db.prepare(`INSERT INTO cloud_transfers
      SELECT ?, ?, ?, ?, ?, 0 WHERE (SELECT count(*) FROM cloud_transfers WHERE owner_id = ?) < 3
      AND (? = 0 OR (SELECT coalesce(sum(json_extract(item.value, '$.size')), 0)
        FROM cloud_transfers, json_each(cloud_transfers.files) AS item) <= ?)
      RETURNING id`).bind(id, user.id, await tokenHash(code), JSON.stringify(files), now + TTL, user.id, Number(useKV), available).first();
    if (!created) return fail('Limita de transfer a fost atinsă. Încearcă mai târziu.', 429);
    return ok({ id: created.id, code });
  }
  if (!key || !/^[a-f0-9-]{36}$/.test(key)) return fail('Transferul nu a fost găsit.', 404);
  const transfer = await db.prepare('SELECT files, expires_at FROM cloud_transfers WHERE id = ? AND owner_id = ? AND ready = 0 AND expires_at > ?')
    .bind(key, user.id, now).first();
  if (!transfer) return fail('Transferul nu mai poate fi modificat.', 404);
  const files = JSON.parse(transfer.files);
  if (method === 'PUT' && action === 'upload') {
    const index = new URL(request.url).searchParams.get('index');
    const file = /^\d{1,2}$/.test(index ?? '') ? files[Number(index)] : null;
    if (!file || !request.body || request.headers.get('Content-Length') !== String(file.size)) {
      return fail('Dimensiunea încărcării nu corespunde.', 400);
    }
    const name = objectKey(key, Number(index));
    if (useKV) {
      const receipt = await db.prepare('SELECT 1 FROM transfer_uploads WHERE transfer_id = ? AND file_index = ?').bind(key, Number(index)).first();
      if (!receipt) {
        await kv.put(name, request.body, { expiration: Math.ceil(transfer.expires_at / 1000) + 60 });
        await db.prepare('INSERT OR IGNORE INTO transfer_uploads VALUES (?, ?)').bind(key, Number(index)).run();
      }
    } else {
      const object = await bucket.put(name, request.body, { onlyIf: { etagDoesNotMatch: '*' } });
      if (!object && (await bucket.head(name))?.size !== file.size) return fail('Piesa nu a putut fi încărcată.', 409);
    }
    return ok({ ok: true });
  }
  if (method === 'POST' && action === 'finish') {
    const complete = useKV
      ? (await db.prepare('SELECT count(*) AS total FROM transfer_uploads WHERE transfer_id = ?').bind(key).first()).total === files.length
      : (await Promise.all(files.map((_, index) => bucket.head(objectKey(key, index)))))
        .every((object, index) => object?.size === files[index].size);
    if (!complete) return fail('Mai sunt piese de încărcat.', 409);
    await db.prepare('UPDATE cloud_transfers SET ready = 1 WHERE id = ? AND owner_id = ?').bind(key, user.id).run();
    return ok({ ok: true });
  }
  return fail('Transferul nu a fost găsit.', 404);
}
